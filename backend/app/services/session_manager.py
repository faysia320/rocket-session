"""세션 생명주기 관리 (CRUD, 프로세스 종료) - PostgreSQL 영속성.

SessionManager는 파사드로서 내부 서브 서비스에 위임합니다:
- SessionProcessManager: 인메모리 프로세스/runner task 관리
- Repository 계층: DB CRUD (SessionRepository, MessageRepository 등)
"""

import asyncio
import logging
import shutil
import uuid
from datetime import datetime
from pathlib import Path

from app.core.exceptions import NotFoundError
from app.core.utils import utc_now
from app.models.session import Session, SessionStatus
from app.repositories.event_repo import EventRepository
from app.repositories.file_change_repo import FileChangeRepository
from app.repositories.message_repo import MessageRepository
from app.repositories.session_repo import SessionRepository, _session_to_dict
from app.repositories.token_snapshot_repo import TokenSnapshotRepository
from app.schemas.session import SessionInfo
from app.services.base import DBService
from app.services.session_process_manager import SessionProcessManager

logger = logging.getLogger(__name__)


_UNSET = object()  # 센티넬: "전달되지 않음" vs "명시적 None" 구분


class SessionManager(DBService):
    """PostgreSQL 기반 세션 저장소 및 관리 (파사드).

    프로세스 관리는 SessionProcessManager에 위임합니다.
    """

    def __init__(self, db, upload_dir: str = ""):
        super().__init__(db)
        self._upload_dir = upload_dir
        self._process_manager = SessionProcessManager()
        # 메시지 배치 큐 + 배치 라이터
        self._message_queue: asyncio.Queue | None = None
        self._message_flush_task: asyncio.Task | None = None
        # 메시지 배치 재시도
        self._message_retry_batch: list[dict] = []
        self._message_retry_count: int = 0
        self._message_max_retries: int = 3

    def start_message_batch_writer(
        self, maxsize: int = 50000, flush_interval: float = 0.3
    ) -> None:
        """메시지 배치 라이터 백그라운드 태스크 시작."""
        self._message_queue = asyncio.Queue(maxsize=maxsize)
        self._message_flush_interval = flush_interval
        self._message_flush_task = asyncio.create_task(
            self._message_batch_writer_loop()
        )

    async def stop_message_batch_writer(self) -> None:
        """메시지 배치 라이터 종료 + 잔여 메시지 flush."""
        if self._message_flush_task:
            self._message_flush_task.cancel()
            try:
                await self._message_flush_task
            except asyncio.CancelledError:
                pass
        await self._flush_messages()

    async def _message_batch_writer_loop(self) -> None:
        """주기적으로 큐의 메시지를 배치 DB 저장."""
        while True:
            await asyncio.sleep(self._message_flush_interval)
            await self._flush_messages()

    async def _flush_messages(self) -> None:
        """큐에 쌓인 메시지를 한번에 배치 저장 (재시도 포함)."""
        if not self._message_queue:
            return
        batch: list[dict] = []
        # 재시도 대기 메시지 먼저 소비
        if self._message_retry_batch:
            batch.extend(self._message_retry_batch)
            self._message_retry_batch = []
        while not self._message_queue.empty():
            try:
                batch.append(self._message_queue.get_nowait())
            except asyncio.QueueEmpty:
                break
        if not batch:
            return
        try:
            async with self._session_scope(MessageRepository) as (session, repo):
                await repo.add_batch(batch)
                await session.commit()
            self._message_retry_count = 0
        except Exception:
            self._message_retry_count += 1
            if self._message_retry_count <= self._message_max_retries:
                logger.warning(
                    "메시지 배치 저장 실패 (%d건, 재시도 %d/%d)",
                    len(batch),
                    self._message_retry_count,
                    self._message_max_retries,
                    exc_info=True,
                )
                self._message_retry_batch = batch
            else:
                logger.error(
                    "메시지 배치 저장 최종 실패 — %d건 드롭 (재시도 %d회 초과)",
                    len(batch),
                    self._message_max_retries,
                )
                self._message_retry_count = 0

    def queue_message(self, **kwargs) -> bool:
        """메시지를 배치 큐에 추가. 큐가 없거나 가득 차면 False 반환."""
        if not self._message_queue:
            return False
        try:
            self._message_queue.put_nowait(kwargs)
            return True
        except asyncio.QueueFull:
            logger.debug("메시지 배치 큐 가득 참 — 동기 저장으로 폴백")
            return False

    async def flush_messages(self) -> None:
        """외부에서 호출 가능한 메시지 flush."""
        await self._flush_messages()

    async def create(
        self,
        work_dir: str,
        allowed_tools: str | None = None,
        system_prompt: str | None = None,
        timeout_seconds: int | None = None,
        permission_mode: bool = False,
        permission_required_tools: list[str] | None = None,
        model: str | None = None,
        max_turns: int | None = None,
        max_budget_usd: float | None = None,
        system_prompt_mode: str = "replace",
        disallowed_tools: str | None = None,
        mcp_server_ids: list[str] | None = None,
        additional_dirs: list[str] | None = None,
        fallback_model: str | None = None,
        worktree_name: str | None = None,
        workflow_enabled: bool = True,
        workspace_id: str | None = None,
        workflow_definition_id: str | None = None,
        workflow_phase: str | None = None,
        name: str | None = None,
    ) -> dict:
        sid = str(uuid.uuid4())[:16]
        created_at = utc_now()
        async with self._session_scope(SessionRepository) as (session, repo):
            entity = Session(
                id=sid,
                work_dir=work_dir,
                created_at=created_at,
                allowed_tools=allowed_tools,
                system_prompt=system_prompt,
                timeout_seconds=timeout_seconds,
                workflow_enabled=True,
                workflow_definition_id=workflow_definition_id,
                workflow_phase=workflow_phase or "research",
                workflow_phase_status="in_progress",
                permission_mode=permission_mode,
                permission_required_tools=permission_required_tools,
                model=model,
                max_turns=max_turns,
                max_budget_usd=max_budget_usd,
                system_prompt_mode=system_prompt_mode,
                disallowed_tools=disallowed_tools,
                mcp_server_ids=mcp_server_ids,
                additional_dirs=additional_dirs,
                fallback_model=fallback_model,
                worktree_name=worktree_name,
                workspace_id=workspace_id,
                name=name,
            )
            await repo.add(entity)
            await session.commit()
            result = _session_to_dict(entity)
        logger.info("세션 생성: %s", sid)
        return result

    async def get(self, session_id: str) -> dict:
        async with self._session_scope(SessionRepository) as (session, repo):
            entity = await repo.get_by_id(session_id)
            if not entity:
                raise NotFoundError(f"세션을 찾을 수 없습니다: {session_id}")
            return _session_to_dict(entity)

    async def exists(self, session_id: str) -> bool:
        """세션 존재 여부만 확인 (경량 쿼리)."""
        async with self._session_scope(SessionRepository) as (session, repo):
            return await repo.exists(session_id)

    async def get_with_counts(self, session_id: str) -> dict:
        """message_count, file_changes_count를 포함한 단일 세션 조회."""
        async with self._session_scope(SessionRepository) as (session, repo):
            result = await repo.get_with_counts(session_id)
            if not result:
                raise NotFoundError(f"세션을 찾을 수 없습니다: {session_id}")
            return result

    async def list_all(self, *, limit: int = 200) -> list[dict]:
        async with self._session_scope(SessionRepository) as (session, repo):
            return await repo.list_with_counts(limit=limit)

    async def delete(self, session_id: str) -> bool:
        await self.kill_process(session_id)
        async with self._session_scope(SessionRepository) as (session, repo):
            deleted = await repo.delete_by_id(session_id)
            await session.commit()
        if not deleted:
            raise NotFoundError(f"세션을 찾을 수 없습니다: {session_id}")
        # 업로드 디렉토리 정리
        if self._upload_dir:
            upload_path = Path(self._upload_dir) / session_id
            if upload_path.exists():
                try:
                    await asyncio.to_thread(shutil.rmtree, upload_path)
                    logger.info("업로드 디렉토리 삭제: %s", upload_path)
                except OSError as e:
                    logger.warning("업로드 디렉토리 삭제 실패: %s - %s", upload_path, e)
        logger.info("세션 삭제: %s", session_id)
        return True

    # --- 프로세스 관리 (SessionProcessManager 위임) ---

    async def kill_process(self, session_id: str):
        """실행 중인 Claude CLI 프로세스 및 runner task를 안전하게 종료."""
        await self._process_manager.kill_process(session_id)
        await self.update_status(session_id, SessionStatus.IDLE)

    def set_process(self, session_id: str, process: asyncio.subprocess.Process):
        self._process_manager.set_process(session_id, process)

    def get_process(self, session_id: str) -> asyncio.subprocess.Process | None:
        return self._process_manager.get_process(session_id)

    def clear_process(self, session_id: str):
        self._process_manager.clear_process(session_id)

    def set_runner_task(self, session_id: str, task: asyncio.Task):
        self._process_manager.set_runner_task(session_id, task)

    def get_runner_task(self, session_id: str) -> asyncio.Task | None:
        return self._process_manager.get_runner_task(session_id)

    def clear_runner_task(self, session_id: str):
        self._process_manager.clear_runner_task(session_id)

    def clear_runner_task_if_match(self, session_id: str, task: asyncio.Task) -> None:
        """현재 등록된 task와 동일한 경우에만 정리 (레이스컨디션 방지)."""
        self._process_manager.clear_runner_task_if_match(session_id, task)

    async def update_status(self, session_id: str, status: str):
        async with self._session_scope(SessionRepository) as (session, repo):
            if not await repo.exists(session_id):
                raise NotFoundError(f"세션을 찾을 수 없습니다: {session_id}")
            await repo.update_status(session_id, status)
            await session.commit()

    async def update_claude_session_id(self, session_id: str, claude_session_id: str):
        async with self._session_scope(SessionRepository) as (session, repo):
            await repo.update_claude_session_id(session_id, claude_session_id)
            await session.commit()

    async def find_by_claude_session_id(self, claude_session_id: str) -> dict | None:
        """claude_session_id로 세션 조회."""
        async with self._session_scope(SessionRepository) as (session, repo):
            entity = await repo.find_by_claude_id(claude_session_id)
            return _session_to_dict(entity) if entity else None

    async def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        timestamp: "str | datetime",
        cost: float | None = None,
        duration_ms: int | None = None,
        is_error: bool = False,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
        cache_creation_tokens: int | None = None,
        cache_read_tokens: int | None = None,
        model: str | None = None,
        message_type: str | None = None,
        tool_use_id: str | None = None,
        tool_name: str | None = None,
        tool_input: dict | None = None,
    ):
        async with self._session_scope(MessageRepository) as (session, repo):
            await repo.add_message(
                session_id=session_id,
                role=role,
                content=content,
                timestamp=timestamp,
                cost=cost,
                duration_ms=duration_ms,
                is_error=is_error,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cache_creation_tokens=cache_creation_tokens,
                cache_read_tokens=cache_read_tokens,
                model=model,
                message_type=message_type,
                tool_use_id=tool_use_id,
                tool_name=tool_name,
                tool_input=tool_input,
            )
            await session.commit()

    async def add_token_snapshot(
        self,
        session_id: str,
        work_dir: str,
        timestamp: "str | datetime",
        workflow_phase: str | None = None,
        model: str | None = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cache_creation_tokens: int = 0,
        cache_read_tokens: int = 0,
    ):
        """토큰 스냅샷을 token_snapshots 테이블에 기록 (세션 삭제와 무관하게 보존)."""
        from app.models.token_snapshot import TokenSnapshot

        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp)

        async with self._session_scope(TokenSnapshotRepository) as (session, repo):
            snapshot = TokenSnapshot(
                session_id=session_id,
                work_dir=work_dir,
                workflow_phase=workflow_phase,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cache_creation_tokens=cache_creation_tokens,
                cache_read_tokens=cache_read_tokens,
                timestamp=timestamp,
            )
            await repo.add(snapshot)

    async def get_history(self, session_id: str) -> list[dict]:
        async with self._session_scope(MessageRepository) as (session, repo):
            return await repo.get_by_session(session_id)

    async def clear_history(self, session_id: str):
        """세션의 대화 기록, 파일 변경, 이벤트를 모두 삭제."""
        async with self._session_scope(
            MessageRepository, FileChangeRepository, EventRepository
        ) as (session, msg_repo, fc_repo, evt_repo):
            await msg_repo.delete_by_session(session_id)
            await fc_repo.delete_by_session(session_id)
            await evt_repo.delete_by_session(session_id)
            await session.commit()

    async def add_file_change(
        self, session_id: str, tool: str, file: str, timestamp: "str | datetime"
    ):
        async with self._session_scope(FileChangeRepository) as (session, repo):
            await repo.add_file_change(
                session_id=session_id, tool=tool, file=file, timestamp=timestamp
            )
            await session.commit()

    async def get_file_changes(self, session_id: str) -> list[dict]:
        async with self._session_scope(FileChangeRepository) as (session, repo):
            return await repo.get_by_session(session_id)

    async def get_session_stats(self, session_id: str) -> dict | None:
        """세션별 누적 통계."""
        async with self._session_scope(SessionRepository) as (session, repo):
            return await repo.get_stats(session_id)

    async def update_settings(
        self,
        session_id: str,
        allowed_tools: str | None = None,
        system_prompt: str | None = None,
        timeout_seconds: int | None = None,
        workflow_enabled: bool | None = None,
        workflow_phase: str | None | object = _UNSET,
        workflow_phase_status: str | None | object = _UNSET,
        permission_mode: bool | None = None,
        permission_required_tools: list[str] | None = None,
        name: str | None = None,
        model: str | None = None,
        max_turns: int | None = None,
        max_budget_usd: float | None = None,
        system_prompt_mode: str | None = None,
        disallowed_tools: str | None = None,
        mcp_server_ids: list[str] | None = None,
        additional_dirs: list[str] | None = None,
        fallback_model: str | None = None,
        parent_session_id: str | None = None,
        forked_at_message_id: int | None = None,
        work_dir: str | None = None,
        worktree_name: str | None = None,
        workflow_original_prompt: str | None | object = _UNSET,
        workflow_definition_id: str | None = None,
    ) -> dict:
        # None = "미전달" 필드: None이 아닌 값만 포함
        maybe_fields = {
            "allowed_tools": allowed_tools,
            "system_prompt": system_prompt,
            "timeout_seconds": timeout_seconds,
            "workflow_enabled": workflow_enabled,
            "permission_mode": permission_mode,
            "permission_required_tools": permission_required_tools,
            "name": name,
            "model": model,
            "max_turns": max_turns,
            "max_budget_usd": max_budget_usd,
            "system_prompt_mode": system_prompt_mode,
            "disallowed_tools": disallowed_tools,
            "mcp_server_ids": mcp_server_ids,
            "additional_dirs": additional_dirs,
            "fallback_model": fallback_model,
            "parent_session_id": parent_session_id,
            "forked_at_message_id": forked_at_message_id,
            "work_dir": work_dir,
            "worktree_name": worktree_name,
            "workflow_definition_id": workflow_definition_id,
        }
        kwargs = {k: v for k, v in maybe_fields.items() if v is not None}
        # _UNSET 센티넬 필드: None도 유효한 값 (DB에서 NULL로 설정)
        if workflow_phase is not _UNSET:
            kwargs["workflow_phase"] = workflow_phase
        if workflow_phase_status is not _UNSET:
            kwargs["workflow_phase_status"] = workflow_phase_status
        if workflow_original_prompt is not _UNSET:
            kwargs["workflow_original_prompt"] = workflow_original_prompt
        async with self._session_scope(SessionRepository) as (session, repo):
            # 워크플로우 불변식: enabled=True → phase 보장
            if kwargs.get("workflow_enabled") is True and workflow_phase is _UNSET:
                existing = await repo.get_by_id(session_id)
                if existing and not existing.workflow_phase:
                    kwargs["workflow_phase"] = "research"
                    kwargs["workflow_phase_status"] = "in_progress"
            entity = await repo.update_settings(session_id, **kwargs)
            if not entity:
                raise NotFoundError(f"세션을 찾을 수 없습니다: {session_id}")
            await session.commit()
            return _session_to_dict(entity)

    @staticmethod
    def to_info(session: dict) -> SessionInfo:
        return SessionInfo.model_validate(session)

    async def fork(self, source_session_id: str, message_id: int | None = None) -> dict:
        """세션 포크: 설정 복사 + 메시지 복사 + 메타데이터 설정 (단일 트랜잭션)."""
        source = await self.get(source_session_id)

        sid = str(uuid.uuid4())[:16]
        created_at = utc_now()
        source_name = source.get("name") or source["id"]

        async with self._session_scope(SessionRepository, MessageRepository) as (
            session,
            sess_repo,
            msg_repo,
        ):
            # 1. 새 세션 생성 (설정 복사, claude_session_id 제외)
            entity = Session(
                id=sid,
                work_dir=source["work_dir"],
                created_at=created_at,
                allowed_tools=source.get("allowed_tools"),
                system_prompt=source.get("system_prompt"),
                timeout_seconds=source.get("timeout_seconds"),
                workflow_enabled=True,
                workflow_phase="research",
                workflow_phase_status="in_progress",
                permission_mode=source.get("permission_mode", False),
                permission_required_tools=source.get("permission_required_tools"),
                model=source.get("model"),
                max_turns=source.get("max_turns"),
                max_budget_usd=source.get("max_budget_usd"),
                system_prompt_mode=source.get("system_prompt_mode", "replace"),
                disallowed_tools=source.get("disallowed_tools"),
                mcp_server_ids=source.get("mcp_server_ids"),
                additional_dirs=source.get("additional_dirs"),
                fallback_model=source.get("fallback_model"),
                # 메타데이터
                name=f"{source_name} (fork)",
                parent_session_id=source_session_id,
                forked_at_message_id=message_id,
            )
            await sess_repo.add(entity)

            # 2. 메시지 복사 (INSERT...SELECT)
            copied = await msg_repo.copy_messages_to_session(
                source_session_id=source_session_id,
                target_session_id=sid,
                up_to_message_id=message_id,
            )

            await session.commit()

        logger.info(
            "세션 포크: %s → %s (메시지 %d개 복사)", source_session_id, sid, copied
        )

        return await self.get_with_counts(sid)

    @staticmethod
    def to_info_dict(session: dict) -> dict:
        return SessionManager.to_info(session).model_dump(mode="json")
