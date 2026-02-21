"""세션 Repository."""

from sqlalchemy import func, select, update

from app.models.file_change import FileChange
from app.models.message import Message
from app.models.session import Session
from app.repositories.base import BaseRepository


class SessionRepository(BaseRepository[Session]):
    """sessions 테이블 CRUD."""

    model_class = Session

    async def get_by_id(self, session_id: str) -> Session | None:
        """세션 ID로 단일 조회."""
        result = await self._session.execute(
            select(Session).where(Session.id == session_id)
        )
        return result.scalar_one_or_none()

    async def list_with_counts(self) -> list[dict]:
        """세션 목록 + message_count, file_changes_count."""
        msg_sub = (
            select(Message.session_id, func.count().label("cnt"))
            .group_by(Message.session_id)
            .subquery()
        )
        fc_sub = (
            select(FileChange.session_id, func.count().label("cnt"))
            .group_by(FileChange.session_id)
            .subquery()
        )
        stmt = (
            select(
                Session,
                func.coalesce(msg_sub.c.cnt, 0).label("message_count"),
                func.coalesce(fc_sub.c.cnt, 0).label("file_changes_count"),
            )
            .outerjoin(msg_sub, msg_sub.c.session_id == Session.id)
            .outerjoin(fc_sub, fc_sub.c.session_id == Session.id)
            .order_by(Session.created_at.desc())
        )
        result = await self._session.execute(stmt)
        rows = result.all()
        return [
            {
                **_session_to_dict(row[0]),
                "message_count": row[1],
                "file_changes_count": row[2],
            }
            for row in rows
        ]

    async def get_with_counts(self, session_id: str) -> dict | None:
        """단일 세션 + message_count, file_changes_count."""
        msg_sub = (
            select(Message.session_id, func.count().label("cnt"))
            .where(Message.session_id == session_id)
            .group_by(Message.session_id)
            .subquery()
        )
        fc_sub = (
            select(FileChange.session_id, func.count().label("cnt"))
            .where(FileChange.session_id == session_id)
            .group_by(FileChange.session_id)
            .subquery()
        )
        stmt = (
            select(
                Session,
                func.coalesce(msg_sub.c.cnt, 0).label("message_count"),
                func.coalesce(fc_sub.c.cnt, 0).label("file_changes_count"),
            )
            .outerjoin(msg_sub, msg_sub.c.session_id == Session.id)
            .outerjoin(fc_sub, fc_sub.c.session_id == Session.id)
            .where(Session.id == session_id)
        )
        result = await self._session.execute(stmt)
        row = result.one_or_none()
        if not row:
            return None
        return {
            **_session_to_dict(row[0]),
            "message_count": row[1],
            "file_changes_count": row[2],
        }

    async def get_stats(self, session_id: str) -> dict | None:
        """세션별 누적 통계 (토큰, 비용, 소요 시간)."""
        stmt = select(
            func.count().label("total_messages"),
            func.coalesce(func.sum(Message.cost), 0).label("total_cost"),
            func.coalesce(func.sum(Message.duration_ms), 0).label("total_duration_ms"),
            func.coalesce(func.sum(Message.input_tokens), 0).label("total_input_tokens"),
            func.coalesce(func.sum(Message.output_tokens), 0).label("total_output_tokens"),
            func.coalesce(func.sum(Message.cache_creation_tokens), 0).label(
                "total_cache_creation_tokens"
            ),
            func.coalesce(func.sum(Message.cache_read_tokens), 0).label(
                "total_cache_read_tokens"
            ),
        ).where(Message.session_id == session_id)
        result = await self._session.execute(stmt)
        row = result.one_or_none()
        if not row:
            return None
        return dict(row._mapping)

    async def update_status(self, session_id: str, status: str) -> None:
        """세션 상태 업데이트."""
        stmt = update(Session).where(Session.id == session_id).values(status=status)
        await self._session.execute(stmt)

    async def update_jsonl_path(self, session_id: str, jsonl_path: str) -> None:
        """JSONL 파일 경로 업데이트."""
        stmt = (
            update(Session).where(Session.id == session_id).values(jsonl_path=jsonl_path)
        )
        await self._session.execute(stmt)

    async def get_jsonl_path(self, session_id: str) -> str | None:
        """세션의 JSONL 파일 경로 조회."""
        stmt = select(Session.jsonl_path).where(Session.id == session_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_claude_session_id(
        self, session_id: str, claude_session_id: str
    ) -> None:
        """Claude CLI 세션 ID 업데이트."""
        stmt = (
            update(Session)
            .where(Session.id == session_id)
            .values(claude_session_id=claude_session_id)
        )
        await self._session.execute(stmt)

    async def update_settings(self, session_id: str, **kwargs) -> Session | None:
        """동적 필드 업데이트. kwargs에 있는 필드만 업데이트."""
        if not kwargs:
            return await self.get_by_id(session_id)
        stmt = update(Session).where(Session.id == session_id).values(**kwargs)
        await self._session.execute(stmt)
        return await self.get_by_id(session_id)

    async def find_by_claude_id(self, claude_session_id: str) -> Session | None:
        """Claude CLI 세션 ID로 세션 조회."""
        stmt = select(Session).where(Session.claude_session_id == claude_session_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def reset_stale_running(self) -> None:
        """서버 재시작 시 running 상태 → idle 복구."""
        stmt = update(Session).where(Session.status == "running").values(status="idle")
        await self._session.execute(stmt)

    async def get_all_claude_session_ids(self) -> set[str]:
        """import된 claude_session_id 목록 조회 (중복 검사용)."""
        stmt = select(Session.claude_session_id).where(
            Session.claude_session_id.isnot(None)
        )
        result = await self._session.execute(stmt)
        return {row[0] for row in result.all()}


def _session_to_dict(session: Session) -> dict:
    """Session ORM 객체 -> dict 변환 헬퍼."""
    return {
        "id": session.id,
        "claude_session_id": session.claude_session_id,
        "work_dir": session.work_dir,
        "status": session.status,
        "created_at": session.created_at,
        "allowed_tools": session.allowed_tools,
        "system_prompt": session.system_prompt,
        "timeout_seconds": session.timeout_seconds,
        "mode": session.mode,
        "permission_mode": session.permission_mode,
        "permission_required_tools": session.permission_required_tools,
        "name": session.name,
        "jsonl_path": session.jsonl_path,
        "model": session.model,
        "max_turns": session.max_turns,
        "max_budget_usd": session.max_budget_usd,
        "system_prompt_mode": session.system_prompt_mode,
        "disallowed_tools": session.disallowed_tools,
        "mcp_server_ids": session.mcp_server_ids,
    }
