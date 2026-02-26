"""팀 태스크 Repository."""

from datetime import datetime, timezone

from sqlalchemy import select, update

from app.models.team_task import TeamTask
from app.repositories.base import BaseRepository


class TeamTaskRepository(BaseRepository[TeamTask]):
    """team_tasks 테이블 CRUD."""

    model_class = TeamTask

    async def list_by_team(
        self, team_id: str, status: str | None = None
    ) -> list[TeamTask]:
        """팀의 태스크 목록 조회."""
        stmt = (
            select(TeamTask)
            .where(TeamTask.team_id == team_id)
            .order_by(TeamTask.order_index.asc(), TeamTask.created_at.asc())
        )
        if status:
            stmt = stmt.where(TeamTask.status == status)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def claim_task(self, task_id: int, member_id: int) -> TeamTask | None:
        """태스크 선점 (FOR UPDATE SKIP LOCKED)."""
        stmt = (
            select(TeamTask)
            .where(TeamTask.id == task_id, TeamTask.status == "pending")
            .with_for_update(skip_locked=True)
        )
        task = (await self._session.execute(stmt)).scalar_one_or_none()
        if not task:
            return None
        now = datetime.now(timezone.utc)
        task.status = "in_progress"
        task.assigned_member_id = member_id
        task.updated_at = now
        await self._session.flush()
        return task

    async def complete_task(
        self, task_id: int, result_summary: str | None = None
    ) -> TeamTask | None:
        """태스크 완료 처리."""
        task = await self.get_by_id(task_id)
        if not task:
            return None
        now = datetime.now(timezone.utc)
        task.status = "completed"
        task.result_summary = result_summary
        task.updated_at = now
        await self._session.flush()
        return task

    async def update_task(self, task_id: int, **kwargs) -> TeamTask | None:
        """태스크 속성 업데이트."""
        if not kwargs:
            return await self.get_by_id(task_id)
        kwargs["updated_at"] = datetime.now(timezone.utc)
        stmt = update(TeamTask).where(TeamTask.id == task_id).values(**kwargs)
        await self._session.execute(stmt)
        await self._session.flush()
        return await self.get_by_id(task_id)

    async def get_by_session_id(self, session_id: str) -> TeamTask | None:
        """실행 세션 ID로 태스크 역조회 (in_progress 상태)."""
        stmt = select(TeamTask).where(
            TeamTask.session_id == session_id,
            TeamTask.status == "in_progress",
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_tasks_by_session_id(self, session_id: str) -> list[TeamTask]:
        """실행 세션 ID로 모든 태스크 조회."""
        stmt = select(TeamTask).where(TeamTask.session_id == session_id)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def update_session_id(self, task_id: int, session_id: str) -> None:
        """태스크에 실행 세션 ID 기록."""
        now = datetime.now(timezone.utc)
        stmt = (
            update(TeamTask)
            .where(TeamTask.id == task_id)
            .values(session_id=session_id, updated_at=now)
        )
        await self._session.execute(stmt)
        await self._session.flush()

    async def reorder_tasks(self, team_id: str, task_ids: list[int]) -> None:
        """태스크 순서 변경."""
        now = datetime.now(timezone.utc)
        for idx, task_id in enumerate(task_ids):
            stmt = (
                update(TeamTask)
                .where(TeamTask.id == task_id, TeamTask.team_id == team_id)
                .values(order_index=idx, updated_at=now)
            )
            await self._session.execute(stmt)
        await self._session.flush()

    async def get_task_summary(self, team_id: str) -> dict:
        """팀의 태스크 요약 통계."""
        tasks = await self.list_by_team(team_id)
        summary = {
            "total": len(tasks),
            "pending": 0,
            "in_progress": 0,
            "completed": 0,
            "failed": 0,
        }
        for t in tasks:
            if t.status in summary:
                summary[t.status] += 1
        return summary
