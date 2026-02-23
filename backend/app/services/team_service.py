"""팀 관리 서비스."""

import logging
import uuid
from datetime import datetime, timezone

from app.core.database import Database
from app.models.team import Team, TeamMember
from app.repositories.team_repo import TeamMemberRepository, TeamRepository
from app.schemas.team import (
    TaskSummary,
    TeamInfo,
    TeamListItem,
    TeamMemberInfo,
)

logger = logging.getLogger(__name__)


class TeamService:
    """팀 CRUD 및 멤버(페르소나) 관리."""

    def __init__(self, db: Database) -> None:
        self._db = db

    @staticmethod
    def _member_to_info(member: TeamMember) -> TeamMemberInfo:
        return TeamMemberInfo(
            id=member.id,
            team_id=member.team_id,
            role=member.role,
            nickname=member.nickname,
            description=member.description,
            system_prompt=member.system_prompt,
            allowed_tools=member.allowed_tools,
            disallowed_tools=member.disallowed_tools,
            model=member.model,
            max_turns=member.max_turns,
            max_budget_usd=member.max_budget_usd,
            mcp_server_ids=member.mcp_server_ids,
            created_at=member.created_at,
            updated_at=member.updated_at,
        )

    @staticmethod
    def _team_to_info(
        team: Team,
        members: list[TeamMemberInfo] | None = None,
        task_summary: TaskSummary | None = None,
    ) -> TeamInfo:
        return TeamInfo(
            id=team.id,
            name=team.name,
            description=team.description,
            status=team.status,
            lead_member_id=team.lead_member_id,
            config=team.config,
            created_at=team.created_at,
            updated_at=team.updated_at,
            members=members or [],
            task_summary=task_summary or TaskSummary(),
        )

    @staticmethod
    def _team_to_list_item(
        team: Team,
        member_count: int = 0,
        task_summary: TaskSummary | None = None,
    ) -> TeamListItem:
        return TeamListItem(
            id=team.id,
            name=team.name,
            description=team.description,
            status=team.status,
            lead_member_id=team.lead_member_id,
            created_at=team.created_at,
            updated_at=team.updated_at,
            member_count=member_count,
            task_summary=task_summary or TaskSummary(),
        )

    # ── 팀 CRUD ──

    async def create_team(
        self,
        name: str,
        description: str | None = None,
        config: dict | None = None,
    ) -> TeamInfo:
        team_id = str(uuid.uuid4())[:16]
        now = datetime.now(timezone.utc).isoformat()
        async with self._db.session() as session:
            repo = TeamRepository(session)
            team = Team(
                id=team_id,
                name=name,
                description=description,
                status="active",
                config=config,
                created_at=now,
                updated_at=now,
            )
            await repo.add(team)
            await session.commit()
            return self._team_to_info(team)

    async def get_team(self, team_id: str) -> TeamInfo | None:
        async with self._db.session() as session:
            repo = TeamRepository(session)
            team = await repo.get_by_id(team_id)
            if not team:
                return None
            member_repo = TeamMemberRepository(session)
            members = await member_repo.get_members(team_id)
            member_infos = [self._member_to_info(m) for m in members]
            return self._team_to_info(team, members=member_infos)

    async def list_teams(self, status: str | None = None) -> list[TeamListItem]:
        async with self._db.session() as session:
            repo = TeamRepository(session)
            rows = await repo.list_with_member_counts(status=status)
            return [
                self._team_to_list_item(row["team"], member_count=row["member_count"])
                for row in rows
            ]

    async def update_team(self, team_id: str, **kwargs) -> TeamInfo | None:
        now = datetime.now(timezone.utc).isoformat()
        kwargs["updated_at"] = now
        async with self._db.session() as session:
            repo = TeamRepository(session)
            team = await repo.update_team(team_id, **kwargs)
            if not team:
                return None
            await session.commit()
            return self._team_to_info(team)

    async def delete_team(self, team_id: str) -> bool:
        async with self._db.session() as session:
            repo = TeamRepository(session)
            deleted = await repo.delete_by_id(team_id)
            await session.commit()
            return deleted

    # ── 멤버(페르소나) 관리 ──

    async def add_member(
        self,
        team_id: str,
        nickname: str,
        role: str = "member",
        description: str | None = None,
        system_prompt: str | None = None,
        allowed_tools: str | None = None,
        disallowed_tools: str | None = None,
        model: str | None = None,
        max_turns: int | None = None,
        max_budget_usd: float | None = None,
        mcp_server_ids: list | None = None,
    ) -> TeamMemberInfo:
        now = datetime.now(timezone.utc).isoformat()
        async with self._db.session() as session:
            team_repo = TeamRepository(session)
            team = await team_repo.get_by_id(team_id)
            if not team:
                raise ValueError("팀을 찾을 수 없습니다")

            member_repo = TeamMemberRepository(session)
            member = await member_repo.add_member(
                team_id=team_id,
                nickname=nickname,
                role=role,
                description=description,
                system_prompt=system_prompt,
                allowed_tools=allowed_tools,
                disallowed_tools=disallowed_tools,
                model=model,
                max_turns=max_turns,
                max_budget_usd=max_budget_usd,
                mcp_server_ids=mcp_server_ids,
                created_at=now,
            )

            # 리드 역할이면 팀의 lead_member_id 업데이트
            if role == "lead":
                await team_repo.update_team(
                    team_id,
                    lead_member_id=member.id,
                    updated_at=now,
                )

            await session.commit()
            return self._member_to_info(member)

    async def update_member(
        self, team_id: str, member_id: int, **kwargs
    ) -> TeamMemberInfo | None:
        now = datetime.now(timezone.utc).isoformat()
        kwargs["updated_at"] = now
        async with self._db.session() as session:
            member_repo = TeamMemberRepository(session)
            member = await member_repo.update_member(member_id, **kwargs)
            if not member or member.team_id != team_id:
                return None
            await session.commit()
            return self._member_to_info(member)

    async def remove_member(self, team_id: str, member_id: int) -> bool:
        async with self._db.session() as session:
            member_repo = TeamMemberRepository(session)
            # 리드가 제거되면 lead_member_id 초기화
            team_repo = TeamRepository(session)
            team = await team_repo.get_by_id(team_id)
            if team and team.lead_member_id == member_id:
                now = datetime.now(timezone.utc).isoformat()
                await team_repo.update_team(
                    team_id, lead_member_id=None, updated_at=now
                )

            removed = await member_repo.remove_member(team_id, member_id)
            await session.commit()
            return removed

    async def set_lead(self, team_id: str, member_id: int) -> TeamInfo | None:
        now = datetime.now(timezone.utc).isoformat()
        async with self._db.session() as session:
            team_repo = TeamRepository(session)
            member_repo = TeamMemberRepository(session)

            member = await member_repo.get_member_by_id(member_id)
            if not member or member.team_id != team_id:
                raise ValueError("해당 멤버를 찾을 수 없습니다")

            # 기존 리드를 member로 변경
            team = await team_repo.get_by_id(team_id)
            if not team:
                return None
            if team.lead_member_id and team.lead_member_id != member_id:
                await member_repo.update_role(team_id, team.lead_member_id, "member")

            # 새 리드 설정
            await member_repo.update_role(team_id, member_id, "lead")
            team = await team_repo.update_team(
                team_id, lead_member_id=member_id, updated_at=now
            )
            await session.commit()
            return self._team_to_info(team) if team else None

    async def get_members(self, team_id: str) -> list[TeamMemberInfo]:
        async with self._db.session() as session:
            member_repo = TeamMemberRepository(session)
            members = await member_repo.get_members(team_id)
            return [self._member_to_info(m) for m in members]
