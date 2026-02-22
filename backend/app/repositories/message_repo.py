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
                Message.message_type,
                Message.tool_use_id,
                Message.tool_name,
                Message.tool_input,
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

    async def copy_messages_to_session(
        self,
        source_session_id: str,
        target_session_id: str,
        up_to_message_id: int | None = None,
    ) -> int:
        """소스 세션 메시지를 타겟으로 복사. Returns 복사된 메시지 수."""
        stmt = select(Message).where(
            Message.session_id == source_session_id
        ).order_by(Message.id)

        if up_to_message_id is not None:
            stmt = stmt.where(Message.id <= up_to_message_id)

        result = await self._session.execute(stmt)
        messages = result.scalars().all()

        for msg in messages:
            new_msg = Message(
                session_id=target_session_id,
                role=msg.role,
                content=msg.content,
                cost=msg.cost,
                duration_ms=msg.duration_ms,
                timestamp=msg.timestamp,
                is_error=msg.is_error,
                input_tokens=msg.input_tokens,
                output_tokens=msg.output_tokens,
                cache_creation_tokens=msg.cache_creation_tokens,
                cache_read_tokens=msg.cache_read_tokens,
                model=msg.model,
                message_type=msg.message_type,
                tool_use_id=msg.tool_use_id,
                tool_name=msg.tool_name,
                tool_input=msg.tool_input,
            )
            self._session.add(new_msg)

        await self._session.flush()
        return len(messages)
