"""세션 생명주기 관리 (CRUD, 프로세스 종료) - SQLite 영속성."""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

from app.core.database import Database
from app.models.session import SessionStatus
from app.schemas.session import SessionInfo

logger = logging.getLogger(__name__)


class SessionManager:
    """SQLite 기반 세션 저장소 및 관리."""

    def __init__(self, db: Database):
        self._db = db
        # 프로세스 핸들은 인메모리로 관리 (DB에 저장 불가)
        self._processes: dict[str, asyncio.subprocess.Process] = {}

    async def create(
        self,
        work_dir: str,
        allowed_tools: str | None = None,
        system_prompt: str | None = None,
        timeout_seconds: int | None = None,
        permission_mode: bool = False,
        permission_required_tools: list[str] | None = None,
    ) -> dict:
        sid = str(uuid.uuid4())[:8]
        created_at = datetime.now(timezone.utc).isoformat()
        perm_tools_json = (
            json.dumps(permission_required_tools) if permission_required_tools else None
        )
        session = await self._db.create_session(
            session_id=sid,
            work_dir=work_dir,
            created_at=created_at,
            allowed_tools=allowed_tools,
            system_prompt=system_prompt,
            timeout_seconds=timeout_seconds,
            permission_mode=permission_mode,
            permission_required_tools=perm_tools_json,
        )
        logger.info("세션 생성: %s", sid)
        return session

    async def get(self, session_id: str) -> dict | None:
        session = await self._db.get_session(session_id)
        if not session:
            logger.warning("세션 조회 실패: %s", session_id)
        return session

    async def get_with_counts(self, session_id: str) -> dict | None:
        """message_count, file_changes_count를 포함한 단일 세션 조회."""
        return await self._db.get_session_with_counts(session_id)

    async def list_all(self) -> list[dict]:
        return await self._db.list_sessions()

    async def delete(self, session_id: str) -> bool:
        await self.kill_process(session_id)
        deleted = await self._db.delete_session(session_id)
        if deleted:
            logger.info("세션 삭제: %s", session_id)
        return deleted

    async def kill_process(self, session_id: str):
        """실행 중인 Claude CLI 프로세스를 안전하게 종료."""
        process = self._processes.get(session_id)
        if process and process.returncode is None:
            try:
                process.terminate()
                await asyncio.wait_for(process.wait(), timeout=5)
            except asyncio.TimeoutError:
                process.kill()
            except Exception:
                pass
        self._processes.pop(session_id, None)
        await self._db.update_session_status(session_id, SessionStatus.IDLE)

    def set_process(self, session_id: str, process: asyncio.subprocess.Process):
        self._processes[session_id] = process

    def get_process(self, session_id: str) -> asyncio.subprocess.Process | None:
        return self._processes.get(session_id)

    def clear_process(self, session_id: str):
        self._processes.pop(session_id, None)

    async def update_status(self, session_id: str, status: str):
        await self._db.update_session_status(session_id, status)

    async def update_claude_session_id(self, session_id: str, claude_session_id: str):
        await self._db.update_claude_session_id(session_id, claude_session_id)

    async def find_by_claude_session_id(self, claude_session_id: str) -> dict | None:
        """claude_session_id로 세션 조회."""
        return await self._db.find_session_by_claude_id(claude_session_id)

    async def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        timestamp: str,
        cost: float | None = None,
        duration_ms: int | None = None,
    ):
        await self._db.add_message(
            session_id=session_id,
            role=role,
            content=content,
            timestamp=timestamp,
            cost=cost,
            duration_ms=duration_ms,
        )

    async def get_history(self, session_id: str) -> list[dict]:
        return await self._db.get_messages(session_id)

    async def add_file_change(
        self, session_id: str, tool: str, file: str, timestamp: str
    ):
        await self._db.add_file_change(
            session_id=session_id, tool=tool, file=file, timestamp=timestamp
        )

    async def get_file_changes(self, session_id: str) -> list[dict]:
        return await self._db.get_file_changes(session_id)

    async def update_settings(
        self,
        session_id: str,
        allowed_tools: str | None = None,
        system_prompt: str | None = None,
        timeout_seconds: int | None = None,
        mode: str | None = None,
        permission_mode: bool | None = None,
        permission_required_tools: list[str] | None = None,
    ) -> dict | None:
        perm_tools_json = (
            json.dumps(permission_required_tools)
            if permission_required_tools is not None
            else None
        )
        return await self._db.update_session_settings(
            session_id=session_id,
            allowed_tools=allowed_tools,
            system_prompt=system_prompt,
            timeout_seconds=timeout_seconds,
            mode=mode,
            permission_mode=permission_mode,
            permission_required_tools=perm_tools_json,
        )

    @staticmethod
    def to_info(session: dict) -> SessionInfo:
        perm_tools_raw = session.get("permission_required_tools")
        perm_tools = None
        if perm_tools_raw:
            try:
                perm_tools = json.loads(perm_tools_raw)
            except (json.JSONDecodeError, TypeError):
                perm_tools = None
        return SessionInfo(
            id=session["id"],
            claude_session_id=session.get("claude_session_id"),
            work_dir=session["work_dir"],
            status=session["status"],
            created_at=session["created_at"],
            message_count=session.get("message_count", 0),
            file_changes_count=session.get("file_changes_count", 0),
            allowed_tools=session.get("allowed_tools"),
            system_prompt=session.get("system_prompt"),
            timeout_seconds=session.get("timeout_seconds"),
            mode=session.get("mode", "normal"),
            permission_mode=bool(session.get("permission_mode", 0)),
            permission_required_tools=perm_tools,
        )

    @staticmethod
    def to_info_dict(session: dict) -> dict:
        return SessionManager.to_info(session).model_dump()
