"""팀 태스크 관리 서비스."""

import logging
from datetime import datetime, timezone

from app.core.database import Database
from app.models.team_task import TeamTask
from app.repositories.team_repo import TeamMemberRepository
from app.repositories.team_task_repo import TeamTaskRepository
from app.schemas.team import TaskSummary, TeamTaskInfo

logger = logging.getLogger(__name__)


class TeamTaskService:
    """팀 태스크 CRUD + 할당 + 의존성 관리."""

    def __init__(self, db: Database) -> None:
        self._db = db

    @staticmethod
    def _task_to_info(
        task: TeamTask, assigned_nickname: str | None = None
    ) -> TeamTaskInfo:
        return TeamTaskInfo(
            id=task.id,
            team_id=task.team_id,
            title=task.title,
            description=task.description,
            status=task.status,
            priority=task.priority,
            assigned_member_id=task.assigned_member_id,
            assigned_nickname=assigned_nickname,
            created_by_member_id=task.created_by_member_id,
            work_dir=task.work_dir,
            session_id=task.session_id,
            result_summary=task.result_summary,
            order_index=task.order_index,
            depends_on_task_id=task.depends_on_task_id,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )

    async def _resolve_nickname(
        self, session, member_id: int | None
    ) -> str | None:
        """멤버 ID로 닉네임 조회."""
        if not member_id:
            return None
        member_repo = TeamMemberRepository(session)
        member = await member_repo.get_member_by_id(member_id)
        return member.nickname if member else None

    # ── CRUD ──

    async def create_task(
        self,
        team_id: str,
        title: str,
        work_dir: str,
        description: str | None = None,
        priority: str = "medium",
        assigned_member_id: int | None = None,
        depends_on_task_id: int | None = None,
        created_by_member_id: int | None = None,
    ) -> TeamTaskInfo:
        now = datetime.now(timezone.utc).isoformat()
        async with self._db.session() as session:
            repo = TeamTaskRepository(session)
            tasks = await repo.list_by_team(team_id)
            order_index = len(tasks)

            task = TeamTask(
                team_id=team_id,
                title=title,
                description=description,
                status="pending",
                priority=priority,
                assigned_member_id=assigned_member_id,
                created_by_member_id=created_by_member_id,
                work_dir=work_dir,
                order_index=order_index,
                depends_on_task_id=depends_on_task_id,
                created_at=now,
                updated_at=now,
            )
            await repo.add(task)
            nickname = await self._resolve_nickname(session, assigned_member_id)
            await session.commit()
            return self._task_to_info(task, assigned_nickname=nickname)

    async def get_task(self, task_id: int) -> TeamTaskInfo | None:
        async with self._db.session() as session:
            repo = TeamTaskRepository(session)
            task = await repo.get_by_id(task_id)
            if not task:
                return None
            nickname = await self._resolve_nickname(
                session, task.assigned_member_id
            )
            return self._task_to_info(task, assigned_nickname=nickname)

    async def list_tasks(
        self, team_id: str, status: str | None = None
    ) -> list[TeamTaskInfo]:
        async with self._db.session() as session:
            repo = TeamTaskRepository(session)
            tasks = await repo.list_by_team(team_id, status=status)
            member_repo = TeamMemberRepository(session)
            members = await member_repo.get_members(team_id)
            nick_map = {m.id: m.nickname for m in members}
            return [
                self._task_to_info(
                    t, assigned_nickname=nick_map.get(t.assigned_member_id)
                )
                for t in tasks
            ]

    async def update_task(self, task_id: int, **kwargs) -> TeamTaskInfo | None:
        async with self._db.session() as session:
            repo = TeamTaskRepository(session)
            task = await repo.update_task(task_id, **kwargs)
            if not task:
                return None
            nickname = await self._resolve_nickname(
                session, task.assigned_member_id
            )
            await session.commit()
            return self._task_to_info(task, assigned_nickname=nickname)

    async def delete_task(self, task_id: int) -> bool:
        async with self._db.session() as session:
            repo = TeamTaskRepository(session)
            deleted = await repo.delete_by_id(task_id)
            await session.commit()
            return deleted

    # ── 할당 ──

    async def claim_task(
        self, task_id: int, member_id: int
    ) -> TeamTaskInfo | None:
        async with self._db.session() as session:
            repo = TeamTaskRepository(session)
            task = await repo.claim_task(task_id, member_id)
            if not task:
                return None
            nickname = await self._resolve_nickname(session, member_id)
            await session.commit()
            return self._task_to_info(task, assigned_nickname=nickname)

    async def complete_task(
        self, task_id: int, result_summary: str | None = None
    ) -> TeamTaskInfo | None:
        async with self._db.session() as session:
            repo = TeamTaskRepository(session)
            task = await repo.complete_task(task_id, result_summary)
            if not task:
                return None
            nickname = await self._resolve_nickname(
                session, task.assigned_member_id
            )
            await session.commit()
            return self._task_to_info(task, assigned_nickname=nickname)

    # ── 순서 ──

    async def reorder_tasks(self, team_id: str, task_ids: list[int]) -> None:
        async with self._db.session() as session:
            repo = TeamTaskRepository(session)
            await repo.reorder_tasks(team_id, task_ids)
            await session.commit()

    # ── 집계 ──

    async def get_task_summary(self, team_id: str) -> TaskSummary:
        async with self._db.session() as session:
            repo = TeamTaskRepository(session)
            summary = await repo.get_task_summary(team_id)
            return TaskSummary(**summary)
