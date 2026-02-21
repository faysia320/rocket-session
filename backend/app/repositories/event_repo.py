"""이벤트 Repository."""

from sqlalchemy import delete, func, insert, select, text

from app.models.event import Event
from app.repositories.base import BaseRepository


class EventRepository(BaseRepository[Event]):
    """events 테이블 CRUD (WebSocket 이벤트 버퍼링)."""

    model_class = Event

    async def add_event(self, **kwargs) -> None:
        """단일 이벤트 추가."""
        evt = Event(**kwargs)
        self._session.add(evt)
        await self._session.flush()

    async def add_batch(self, events: list[dict]) -> None:
        """이벤트 배치 저장."""
        if not events:
            return
        stmt = insert(Event).values(events)
        await self._session.execute(stmt)

    async def get_after(self, session_id: str, after_seq: int) -> list[dict]:
        """특정 seq 이후의 이벤트 조회 (재연결 복구용)."""
        stmt = (
            select(Event.seq, Event.event_type, Event.payload, Event.timestamp)
            .where(Event.session_id == session_id, Event.seq > after_seq)
            .order_by(Event.seq)
        )
        result = await self._session.execute(stmt)
        return [dict(row._mapping) for row in result.all()]

    async def get_all_events(self, session_id: str) -> list[dict]:
        """세션의 전체 이벤트 조회."""
        stmt = (
            select(Event.seq, Event.event_type, Event.payload, Event.timestamp)
            .where(Event.session_id == session_id)
            .order_by(Event.seq)
        )
        result = await self._session.execute(stmt)
        return [dict(row._mapping) for row in result.all()]

    async def get_current_turn_events(self, session_id: str) -> list[dict]:
        """마지막 user_message 이후의 이벤트 조회 (현재 턴)."""
        # 마지막 user_message의 seq 조회
        last_seq_stmt = select(func.max(Event.seq)).where(
            Event.session_id == session_id,
            Event.event_type == "user_message",
        )
        result = await self._session.execute(last_seq_stmt)
        last_user_seq = result.scalar_one_or_none() or 0

        if last_user_seq == 0:
            return []

        return await self.get_after(session_id, last_user_seq)

    async def delete_by_session(self, session_id: str) -> None:
        """세션의 전체 이벤트 삭제."""
        stmt = delete(Event).where(Event.session_id == session_id)
        await self._session.execute(stmt)

    async def get_max_seq_per_session(self) -> dict[str, int]:
        """세션별 최대 seq 조회 (서버 재시작 시 seq 카운터 복원용)."""
        stmt = select(Event.session_id, func.max(Event.seq).label("max_seq")).group_by(
            Event.session_id
        )
        result = await self._session.execute(stmt)
        return {row.session_id: row.max_seq for row in result.all()}

    async def cleanup_old_events(self, max_age_hours: int = 24) -> int:
        """지정 시간 이전의 오래된 이벤트 삭제. 삭제된 행 수 반환."""
        # PostgreSQL INTERVAL을 사용하여 ISO 타임스탬프 문자열 비교
        stmt = delete(Event).where(
            Event.timestamp
            < text(
                f"to_char(NOW() - INTERVAL '{max_age_hours} hours', "
                f"'YYYY-MM-DD\"T\"HH24:MI:SS')"
            )
        )
        result = await self._session.execute(stmt)
        return result.rowcount
