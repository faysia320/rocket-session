"""팀 Repository."""

from sqlalchemy import delete, func, select, update

from app.models.team import Team, TeamMember
from app.repositories.base import BaseRepository


class TeamRepository(BaseRepository[Team]):
    """teams 테이블 CRUD."""

    model_class = Team

    async def list_all(self, status: str | None = None) -> list[Team]:
        """팀 목록 조회. status 필터 가능."""
        stmt = select(Team).order_by(Team.created_at.desc())
        if status:
            stmt = stmt.where(Team.status == status)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_with_member_counts(
        self, status: str | None = None
    ) -> list[dict]:
        """팀 목록 + 멤버 수 조회."""
        member_count = (
            select(func.count())
            .where(TeamMember.team_id == Team.id)
            .correlate(Team)
            .scalar_subquery()
            .label("member_count")
        )
        stmt = select(Team, member_count).order_by(Team.created_at.desc())
        if status:
            stmt = stmt.where(Team.status == status)
        result = await self._session.execute(stmt)
        rows = result.all()
        return [
            {
                "team": row[0],
                "member_count": row[1],
            }
            for row in rows
        ]

    async def update_team(self, team_id: str, **kwargs) -> Team | None:
        """팀 속성 업데이트."""
        if not kwargs:
            return await self.get_by_id(team_id)
        stmt = update(Team).where(Team.id == team_id).values(**kwargs)
        await self._session.execute(stmt)
        await self._session.flush()
        return await self.get_by_id(team_id)

    async def update_status(self, team_id: str, status: str) -> None:
        """팀 상태 업데이트."""
        stmt = update(Team).where(Team.id == team_id).values(status=status)
        await self._session.execute(stmt)


class TeamMemberRepository:
    """team_members 테이블 CRUD."""

    def __init__(self, session):
        self._session = session

    async def add_member(
        self,
        team_id: str,
        session_id: str,
        role: str,
        nickname: str | None,
        joined_at: str,
    ) -> TeamMember:
        """멤버 추가 (중복 시 기존 반환)."""
        existing = await self._session.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_id,
                TeamMember.session_id == session_id,
            )
        )
        member = existing.scalar_one_or_none()
        if member:
            return member
        member = TeamMember(
            team_id=team_id,
            session_id=session_id,
            role=role,
            nickname=nickname,
            joined_at=joined_at,
        )
        self._session.add(member)
        await self._session.flush()
        return member

    async def remove_member(self, team_id: str, session_id: str) -> bool:
        """멤버 제거."""
        stmt = delete(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.session_id == session_id,
        )
        result = await self._session.execute(stmt)
        return result.rowcount > 0

    async def get_members(self, team_id: str) -> list[TeamMember]:
        """팀 멤버 목록 조회."""
        stmt = (
            select(TeamMember)
            .where(TeamMember.team_id == team_id)
            .order_by(TeamMember.joined_at.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_member(
        self, team_id: str, session_id: str
    ) -> TeamMember | None:
        """특정 멤버 조회."""
        stmt = select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.session_id == session_id,
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_teams_by_session(self, session_id: str) -> list[dict]:
        """세션이 속한 팀 목록."""
        stmt = (
            select(TeamMember.team_id, TeamMember.role, TeamMember.nickname, Team.name)
            .join(Team, Team.id == TeamMember.team_id)
            .where(TeamMember.session_id == session_id)
        )
        result = await self._session.execute(stmt)
        return [dict(row._mapping) for row in result.all()]

    async def update_role(
        self, team_id: str, session_id: str, role: str
    ) -> None:
        """멤버 역할 변경."""
        stmt = (
            update(TeamMember)
            .where(
                TeamMember.team_id == team_id,
                TeamMember.session_id == session_id,
            )
            .values(role=role)
        )
        await self._session.execute(stmt)
