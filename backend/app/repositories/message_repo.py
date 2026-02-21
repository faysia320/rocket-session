"""메시지 Repository."""

from sqlalchemy import delete, func, insert, select

from app.models.message import Message
from app.repositories.base import BaseRepository


class MessageRepository(BaseRepository[Message]):
    """messages 테이블 CRUD."""

    model_class = Message

    async def add_message(self, **kwargs) -> None:
        """단일 메시지 추가."""
        msg = Message(**kwargs)
        self._session.add(msg)
        await self._session.flush()

    async def add_batch(self, messages: list[dict]) -> None:
        """메시지 배치 저장 (import 등에서 사용)."""
        if not messages:
            return
        stmt = insert(Message).values(messages)
        await self._session.execute(stmt)

    async def get_by_session(self, session_id: str) -> list[dict]:
        """세션의 전체 메시지 조회 (시간순)."""
        stmt = (
            select(
                Message.role,
                Message.content,
                Message.cost,
                Message.duration_ms,
                Message.timestamp,
                Message.is_error,
                Message.input_tokens,
                Message.output_tokens,
                Message.cache_creation_tokens,
                Message.cache_read_tokens,
                Message.model,
            )
            .where(Message.session_id == session_id)
            .order_by(Message.id)
        )
        result = await self._session.execute(stmt)
        return [dict(row._mapping) for row in result.all()]

    async def count_by_session(self, session_id: str) -> int:
        """세션의 메시지 수 조회."""
        stmt = (
            select(func.count())
            .select_from(Message)
            .where(Message.session_id == session_id)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def delete_by_session(self, session_id: str) -> None:
        """세션의 전체 메시지 삭제."""
        stmt = delete(Message).where(Message.session_id == session_id)
        await self._session.execute(stmt)
