"""팀 메시지 서비스."""

from __future__ import annotations

from app.core.utils import utc_now
from app.models.team_message import TeamMessage
from app.repositories.team_message_repo import TeamMessageRepository
from app.repositories.team_repo import TeamMemberRepository
from app.schemas.team import TeamMessageInfo
from app.services.base import DBService


class TeamMessageService(DBService):
    """팀 메시지 CRUD + 닉네임 조회."""

    async def send_message(
        self,
        team_id: str,
        from_member_id: int,
        content: str,
        to_member_id: int | None = None,
        message_type: str = "info",
        metadata_json: str | None = None,
    ) -> TeamMessageInfo:
        """메시지 전송 (DB 저장)."""
        async with self._session_scope(TeamMessageRepository, TeamMemberRepository) as (
            session,
            repo,
            member_repo,
        ):
            msg = TeamMessage(
                team_id=team_id,
                from_member_id=from_member_id,
                to_member_id=to_member_id,
                content=content,
                message_type=message_type,
                metadata_json=metadata_json,
                is_read=False,
                created_at=utc_now(),
            )
            await repo.add(msg)
            await session.commit()

            # 닉네임 조회
            member = await member_repo.get_member_by_id(from_member_id)
            from_nickname = member.nickname if member else None

            return TeamMessageInfo(
                id=msg.id,
                team_id=msg.team_id,
                from_member_id=msg.from_member_id,
                to_member_id=msg.to_member_id,
                content=msg.content,
                message_type=msg.message_type,
                metadata_json=msg.metadata_json,
                is_read=msg.is_read,
                created_at=msg.created_at,
                from_nickname=from_nickname,
            )

    async def list_messages(
        self,
        team_id: str,
        after_id: int | None = None,
        limit: int = 50,
    ) -> list[TeamMessageInfo]:
        """팀 메시지 목록."""
        async with self._session_scope(TeamMessageRepository, TeamMemberRepository) as (
            session,
            repo,
            member_repo,
        ):
            messages = await repo.list_by_team(team_id, after_id=after_id, limit=limit)

            # 닉네임 맵 구성
            members = await member_repo.get_members(team_id)
            nickname_map = {m.id: m.nickname for m in members}

            return [
                TeamMessageInfo(
                    id=m.id,
                    team_id=m.team_id,
                    from_member_id=m.from_member_id,
                    to_member_id=m.to_member_id,
                    content=m.content,
                    message_type=m.message_type,
                    metadata_json=m.metadata_json,
                    is_read=m.is_read,
                    created_at=m.created_at,
                    from_nickname=nickname_map.get(m.from_member_id),
                )
                for m in messages
            ]

    async def mark_as_read(self, message_ids: list[int]) -> int:
        """메시지를 읽음 처리."""
        async with self._session_scope(TeamMessageRepository) as (session, repo):
            count = await repo.mark_as_read(message_ids)
            await session.commit()
            return count

    async def get_unread_count(self, team_id: str, member_id: int) -> int:
        """안 읽은 메시지 수."""
        async with self._session_scope(TeamMessageRepository) as (session, repo):
            return await repo.get_unread_count(team_id, member_id)
