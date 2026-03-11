"""메시지 Repository."""

from sqlalchemy import delete, func, insert, literal_column, select

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

    _MESSAGE_COLUMNS = [
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
    ]

    @staticmethod
    def _rows_to_dicts(rows) -> list[dict]:
        result = []
        for row in rows:
            d = dict(row._mapping)
            if hasattr(d.get("timestamp"), "isoformat"):
                d["timestamp"] = d["timestamp"].isoformat()
            result.append(d)
        return result

    async def get_by_session(
        self, session_id: str, *, limit: int | None = None
    ) -> list[dict]:
        """세션의 메시지 조회 (시간순). limit 지정 시 최신 N개만 반환."""
        if limit is not None:
            # 최신 limit개를 서브쿼리로 가져온 후 시간순 정렬
            sub = (
                select(Message.id)
                .where(Message.session_id == session_id)
                .order_by(Message.timestamp.desc(), Message.id.desc())
                .limit(limit)
                .subquery()
            )
            stmt = (
                select(*self._MESSAGE_COLUMNS)
                .where(Message.id.in_(select(sub.c.id)))
                .order_by(Message.timestamp, Message.id)
            )
        else:
            stmt = (
                select(*self._MESSAGE_COLUMNS)
                .where(Message.session_id == session_id)
                .order_by(Message.timestamp, Message.id)
            )
        result = await self._session.execute(stmt)
        return self._rows_to_dicts(result.all())

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
        """소스 세션 메시지를 타겟으로 복사 (INSERT...SELECT, 메모리 O(1)). Returns 복사된 메시지 수."""
        _cols = [
            literal_column(f"'{target_session_id}'").label("session_id"),
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
        ]
        source_q = (
            select(*_cols)
            .where(Message.session_id == source_session_id)
            .order_by(Message.timestamp, Message.id)
        )
        if up_to_message_id is not None:
            source_q = source_q.where(Message.id <= up_to_message_id)

        insert_stmt = insert(Message).from_select(
            [
                "session_id",
                "role",
                "content",
                "cost",
                "duration_ms",
                "timestamp",
                "is_error",
                "input_tokens",
                "output_tokens",
                "cache_creation_tokens",
                "cache_read_tokens",
                "model",
                "message_type",
                "tool_use_id",
                "tool_name",
                "tool_input",
            ],
            source_q,
        )
        result = await self._session.execute(insert_stmt)
        await self._session.flush()
        return result.rowcount
