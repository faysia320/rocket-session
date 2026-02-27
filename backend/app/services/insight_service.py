"""워크스페이스 인사이트 서비스 — 수동 CRUD 관리."""

import logging
from datetime import datetime, timezone

from app.core.database import Database
from app.models.workspace_insight import WorkspaceInsight
from app.repositories.workspace_insight_repo import WorkspaceInsightRepository
from app.schemas.workspace_insight import (
    CreateInsightRequest,
    UpdateInsightRequest,
    WorkspaceInsightInfo,
)
from app.services.base import DBService

logger = logging.getLogger(__name__)


class InsightService(DBService):
    """워크스페이스 인사이트 관리 서비스."""

    def __init__(self, db: Database) -> None:
        super().__init__(db)

    async def list_insights(
        self,
        workspace_id: str,
        category: str | None = None,
        include_archived: bool = False,
    ) -> list[WorkspaceInsightInfo]:
        """워크스페이스별 인사이트 조회."""
        async with self._session_scope(WorkspaceInsightRepository) as (
            _session,
            repo,
        ):
            items = await repo.list_by_workspace(
                workspace_id, category=category, include_archived=include_archived
            )
            return [WorkspaceInsightInfo.model_validate(i) for i in items]

    async def create_insight(
        self, workspace_id: str, req: CreateInsightRequest
    ) -> WorkspaceInsightInfo:
        """수동 인사이트 생성."""
        now = datetime.now(timezone.utc)
        async with self._session_scope(WorkspaceInsightRepository) as (session, repo):
            entity = WorkspaceInsight(
                workspace_id=workspace_id,
                category=req.category,
                title=req.title,
                content=req.content,
                tags=req.tags,
                file_paths=req.file_paths,
                is_auto_generated=False,
                created_at=now,
                updated_at=now,
            )
            await repo.add(entity)
            await session.commit()
            return WorkspaceInsightInfo.model_validate(entity)

    async def update_insight(
        self, insight_id: int, req: UpdateInsightRequest
    ) -> WorkspaceInsightInfo | None:
        """인사이트 수정."""
        async with self._session_scope(WorkspaceInsightRepository) as (session, repo):
            update_data = req.model_dump(exclude_unset=True)
            if update_data:
                update_data["updated_at"] = datetime.now(timezone.utc)
            entity = await repo.update_by_id(insight_id, **update_data)
            if not entity:
                return None
            await session.commit()
            return WorkspaceInsightInfo.model_validate(entity)

    async def delete_insight(self, insight_id: int) -> bool:
        """인사이트 삭제."""
        async with self._session_scope(WorkspaceInsightRepository) as (session, repo):
            deleted = await repo.delete_by_id(insight_id)
            await session.commit()
            return deleted

    async def archive_insights(self, ids: list[int]) -> int:
        """인사이트 다건 아카이브."""
        async with self._session_scope(WorkspaceInsightRepository) as (session, repo):
            count = await repo.archive_by_ids(ids)
            await session.commit()
            return count
