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
    """팀 CRUD 및 멤버 관리."""

    def __init__(self, db: Database) -> None:
        self._db = db

    @staticmethod
    def _member_to_info(
        member: TeamMember,
        session_status: str | None = None,
        session_name: str | None = None,
    ) -> TeamMemberInfo:
        return TeamMemberInfo(
            id=member.id,
            team_id=member.team_id,
            session_id=member.session_id,
            role=member.role,
            nickname=member.nickname,
            joined_at=member.joined_at,
            session_status=session_status,
            session_name=session_name,
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
            lead_session_id=team.lead_session_id,
            work_dir=team.work_dir,
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
            lead_session_id=team.lead_session_id,
            work_dir=team.work_dir,
            created_at=team.created_at,
            updated_at=team.updated_at,
            member_count=member_count,
            task_summary=task_summary or TaskSummary(),
        )

    # ── 팀 CRUD ──

    async def create_team(
        self,
        name: str,
        work_dir: str,
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
                work_dir=work_dir,
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

            # 세션 상태 조회
            from app.repositories.session_repo import SessionRepository

            session_repo = SessionRepository(session)
            member_infos = []
            for m in members:
                s = await session_repo.get_by_id(m.session_id)
                member_infos.append(
                    self._member_to_info(
                        m,
                        session_status=s.status if s else None,
                        session_name=s.name if s else None,
                    )
                )
            return self._team_to_info(team, members=member_infos)

    async def list_teams(
        self, status: str | None = None
    ) -> list[TeamListItem]:
        async with self._db.session() as session:
            repo = TeamRepository(session)
            rows = await repo.list_with_member_counts(status=status)
            return [
                self._team_to_list_item(
                    row["team"], member_count=row["member_count"]
                )
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
            # 간소화된 반환 (멤버 없이)
            return self._team_to_info(team)

    async def delete_team(self, team_id: str) -> bool:
        async with self._db.session() as session:
            repo = TeamRepository(session)
            deleted = await repo.delete_by_id(team_id)
            await session.commit()
            return deleted

    # ── 멤버 관리 ──

    async def add_member(
        self,
        team_id: str,
        session_id: str,
        role: str = "member",
        nickname: str | None = None,
    ) -> TeamMemberInfo:
        now = datetime.now(timezone.utc).isoformat()
        async with self._db.session() as session:
            # 팀 존재 확인
            team_repo = TeamRepository(session)
            team = await team_repo.get_by_id(team_id)
            if not team:
                raise ValueError("팀을 찾을 수 없습니다")

            member_repo = TeamMemberRepository(session)
            member = await member_repo.add_member(
                team_id, session_id, role, nickname, now
            )

            # 리드 역할이면 팀의 lead_session_id 업데이트
            if role == "lead":
                await team_repo.update_team(
                    team_id,
                    lead_session_id=session_id,
                    updated_at=now,
                )

            await session.commit()
            return self._member_to_info(member)

    async def remove_member(self, team_id: str, session_id: str) -> bool:
        async with self._db.session() as session:
            member_repo = TeamMemberRepository(session)
            removed = await member_repo.remove_member(team_id, session_id)

            if removed:
                # 리드가 제거되면 lead_session_id 초기화
                team_repo = TeamRepository(session)
                team = await team_repo.get_by_id(team_id)
                if team and team.lead_session_id == session_id:
                    now = datetime.now(timezone.utc).isoformat()
                    await team_repo.update_team(
                        team_id, lead_session_id=None, updated_at=now
                    )

            await session.commit()
            return removed

    async def set_lead(self, team_id: str, session_id: str) -> TeamInfo | None:
        now = datetime.now(timezone.utc).isoformat()
        async with self._db.session() as session:
            team_repo = TeamRepository(session)
            member_repo = TeamMemberRepository(session)

            # 멤버 확인
            member = await member_repo.get_member(team_id, session_id)
            if not member:
                raise ValueError("해당 세션은 팀 멤버가 아닙니다")

            # 기존 리드를 member로 변경
            team = await team_repo.get_by_id(team_id)
            if not team:
                return None
            if team.lead_session_id and team.lead_session_id != session_id:
                await member_repo.update_role(team_id, team.lead_session_id, "member")

            # 새 리드 설정
            await member_repo.update_role(team_id, session_id, "lead")
            team = await team_repo.update_team(
                team_id, lead_session_id=session_id, updated_at=now
            )
            await session.commit()
            return self._team_to_info(team) if team else None

    async def get_members(self, team_id: str) -> list[TeamMemberInfo]:
        async with self._db.session() as session:
            member_repo = TeamMemberRepository(session)
            members = await member_repo.get_members(team_id)

            from app.repositories.session_repo import SessionRepository

            session_repo = SessionRepository(session)
            result = []
            for m in members:
                s = await session_repo.get_by_id(m.session_id)
                result.append(
                    self._member_to_info(
                        m,
                        session_status=s.status if s else None,
                        session_name=s.name if s else None,
                    )
                )
            return result

    async def get_teams_by_session(self, session_id: str) -> list[dict]:
        """세션이 속한 팀 목록."""
        async with self._db.session() as session:
            member_repo = TeamMemberRepository(session)
            return await member_repo.get_teams_by_session(session_id)
