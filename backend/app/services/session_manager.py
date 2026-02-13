"""세션 생명주기 관리 (CRUD, 프로세스 종료)."""

import asyncio
import uuid

from app.models.session import Session, SessionStatus
from app.schemas.session import SessionInfo


class SessionManager:
    """인메모리 세션 저장소 및 관리."""

    def __init__(self):
        self._sessions: dict[str, Session] = {}

    def create(self, work_dir: str) -> Session:
        sid = str(uuid.uuid4())[:8]
        session = Session(sid, work_dir)
        self._sessions[sid] = session
        return session

    def get(self, session_id: str) -> Session | None:
        return self._sessions.get(session_id)

    def list_all(self) -> list[Session]:
        return list(self._sessions.values())

    async def delete(self, session_id: str) -> bool:
        session = self._sessions.get(session_id)
        if not session:
            return False
        await self.kill_process(session)
        del self._sessions[session_id]
        return True

    async def kill_process(self, session: Session):
        """실행 중인 Claude CLI 프로세스를 안전하게 종료."""
        if session.process and session.process.returncode is None:
            try:
                session.process.terminate()
                await asyncio.wait_for(session.process.wait(), timeout=5)
            except asyncio.TimeoutError:
                session.process.kill()
            except Exception:
                pass
        session.process = None
        session.status = SessionStatus.IDLE

    @staticmethod
    def to_info(session: Session) -> SessionInfo:
        return SessionInfo(
            id=session.id,
            claude_session_id=session.claude_session_id,
            work_dir=session.work_dir,
            status=session.status.value,
            created_at=session.created_at,
            message_count=len(session.history),
            file_changes_count=len(session.file_changes),
        )

    @staticmethod
    def to_info_dict(session: Session) -> dict:
        return SessionManager.to_info(session).model_dump()
