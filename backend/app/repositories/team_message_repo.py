"""팀 메시지 Repository."""

from sqlalchemy import func, select, update

from app.models.team_message import TeamMessage
from app.repositories.base import BaseRepository


class TeamMessageRepository(BaseRepository[TeamMessage]):
    """team_messages CRUD."""

    model_class = TeamMessage

    async def list_by_team(
        self,
        team_id: str,
        after_id: int | None = None,
        limit: int = 50,
    ) -> list[TeamMessage]:
        """팀 메시지 목록 (최신순, after_id 이후)."""
        stmt = (
            select(TeamMessage)
            .where(TeamMessage.team_id == team_id)
        )
        if after_id:
            stmt = stmt.where(TeamMessage.id > after_id)
        stmt = stmt.order_by(TeamMessage.id.asc()).limit(limit)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def mark_as_read(self, message_ids: list[int]) -> int:
        """메시지를 읽음 처리. 업데이트된 행 수 반환."""
        stmt = (
            update(TeamMessage)
            .where(TeamMessage.id.in_(message_ids))
            .values(is_read=True)
        )
        result = await self._session.execute(stmt)
        return result.rowcount

    async def get_unread_count(
        self, team_id: str, member_id: int
    ) -> int:
        """특정 멤버의 안 읽은 메시지 수."""
        stmt = (
            select(func.count(TeamMessage.id))
            .where(
                TeamMessage.team_id == team_id,
                TeamMessage.is_read == False,  # noqa: E712
                TeamMessage.from_member_id != member_id,
            )
        )
        result = await self._session.execute(stmt)
        return result.scalar() or 0
