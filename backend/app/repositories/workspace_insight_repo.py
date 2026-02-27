"""워크스페이스 인사이트 Repository."""

from typing import Any

from sqlalchemy import and_, delete, func, or_, select, update

from app.models.workspace_insight import WorkspaceInsight
from app.repositories.base import BaseRepository


class WorkspaceInsightRepository(BaseRepository[WorkspaceInsight]):
    """workspace_insights CRUD + 도메인 쿼리."""

    model_class = WorkspaceInsight

    async def list_by_workspace(
        self,
        workspace_id: str,
        category: str | None = None,
        include_archived: bool = False,
        limit: int = 50,
    ) -> list[WorkspaceInsight]:
        """워크스페이스별 인사이트 조회."""
        conditions: list[Any] = [WorkspaceInsight.workspace_id == workspace_id]
        if category:
            conditions.append(WorkspaceInsight.category == category)
        if not include_archived:
            conditions.append(WorkspaceInsight.is_archived == False)  # noqa: E712

        stmt = (
            select(WorkspaceInsight)
            .where(and_(*conditions))
            .order_by(WorkspaceInsight.created_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_session(self, session_id: str) -> list[WorkspaceInsight]:
        """특정 세션에서 추출된 인사이트 조회."""
        stmt = (
            select(WorkspaceInsight)
            .where(WorkspaceInsight.session_id == session_id)
            .order_by(WorkspaceInsight.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def search_by_keywords(
        self,
        workspace_id: str,
        keywords: list[str],
        limit: int = 10,
    ) -> list[WorkspaceInsight]:
        """키워드 기반 인사이트 검색 (title, content, tags에서 ILIKE 매칭)."""
        if not keywords:
            return await self.list_by_workspace(workspace_id, limit=limit)

        keyword_conditions = []
        for kw in keywords:
            pattern = f"%{kw}%"
            keyword_conditions.append(
                or_(
                    WorkspaceInsight.title.ilike(pattern),
                    WorkspaceInsight.content.ilike(pattern),
                    func.cast(WorkspaceInsight.tags, sa_text()).ilike(pattern),
                )
            )

        stmt = (
            select(WorkspaceInsight)
            .where(
                and_(
                    WorkspaceInsight.workspace_id == workspace_id,
                    WorkspaceInsight.is_archived == False,  # noqa: E712
                    or_(*keyword_conditions),
                )
            )
            .order_by(WorkspaceInsight.relevance_score.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def bulk_create(
        self, insights: list[WorkspaceInsight]
    ) -> list[WorkspaceInsight]:
        """다건 인사이트 생성."""
        self._session.add_all(insights)
        await self._session.flush()
        return insights

    async def archive_by_ids(self, ids: list[int]) -> int:
        """ID 목록으로 인사이트 아카이브."""
        if not ids:
            return 0
        stmt = (
            update(WorkspaceInsight)
            .where(WorkspaceInsight.id.in_(ids))
            .values(is_archived=True)
        )
        result = await self._session.execute(stmt)
        return result.rowcount

    async def count_by_workspace(self, workspace_id: str) -> int:
        """워크스페이스별 인사이트 수."""
        stmt = (
            select(func.count())
            .select_from(WorkspaceInsight)
            .where(
                and_(
                    WorkspaceInsight.workspace_id == workspace_id,
                    WorkspaceInsight.is_archived == False,  # noqa: E712
                )
            )
        )
        result = await self._session.execute(stmt)
        return result.scalar() or 0

    async def delete_by_workspace(self, workspace_id: str) -> int:
        """워크스페이스의 모든 인사이트 삭제."""
        stmt = delete(WorkspaceInsight).where(
            WorkspaceInsight.workspace_id == workspace_id
        )
        result = await self._session.execute(stmt)
        return result.rowcount


def sa_text():
    """JSONB를 TEXT로 캐스팅하기 위한 헬퍼."""
    from sqlalchemy import Text

    return Text
