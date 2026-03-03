"""워크스페이스 인사이트 서비스 — 수동 CRUD 관리 + 세션 컨텍스트 주입."""

import logging
import time
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


_CATEGORY_LABELS: dict[str, str] = {
    "pattern": "패턴",
    "gotcha": "주의사항",
    "decision": "결정",
    "file_map": "파일맵",
    "dependency": "의존성",
}


class InsightService(DBService):
    """워크스페이스 인사이트 관리 서비스."""

    MAX_CHARS_PER_INSIGHT = 800
    MAX_TOTAL_CHARS = 4000
    MIN_RELEVANCE_SCORE = 0.3
    CACHE_TTL_SECONDS = 60

    def __init__(self, db: Database) -> None:
        super().__init__(db)
        self._context_cache: dict[str, tuple[float, str]] = {}

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
            result = WorkspaceInsightInfo.model_validate(entity)
        self.invalidate_context_cache(workspace_id)
        return result

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
            result = WorkspaceInsightInfo.model_validate(entity)
        self.invalidate_context_cache(result.workspace_id)
        return result

    async def delete_insight(self, insight_id: int) -> bool:
        """인사이트 삭제."""
        workspace_id: str | None = None
        async with self._session_scope(WorkspaceInsightRepository) as (session, repo):
            entity = await repo.get_by_id(insight_id)
            if entity:
                workspace_id = entity.workspace_id
            deleted = await repo.delete_by_id(insight_id)
            await session.commit()
        if workspace_id:
            self.invalidate_context_cache(workspace_id)
        return deleted

    async def archive_insights(self, ids: list[int]) -> int:
        """인사이트 다건 아카이브."""
        async with self._session_scope(WorkspaceInsightRepository) as (session, repo):
            count = await repo.archive_by_ids(ids)
            await session.commit()
        self.invalidate_context_cache()
        return count

    # ── 세션 컨텍스트 주입 ──────────────────────────────────

    async def build_insight_context(self, workspace_id: str) -> str:
        """세션 시스템 프롬프트 주입용 인사이트 컨텍스트 생성.

        - 아카이브되지 않은 인사이트만 포함
        - relevance_score >= MIN_RELEVANCE_SCORE 필터링
        - relevance_score 내림차순 정렬
        - 개별/전체 글자수 제한 적용
        """
        cached = self._context_cache.get(workspace_id)
        if cached and time.time() - cached[0] < self.CACHE_TTL_SECONDS:
            return cached[1]

        insights = await self.list_insights(workspace_id, include_archived=False)

        filtered = sorted(
            (i for i in insights if i.relevance_score >= self.MIN_RELEVANCE_SCORE),
            key=lambda i: i.relevance_score,
            reverse=True,
        )

        if not filtered:
            self._context_cache[workspace_id] = (time.time(), "")
            return ""

        parts: list[str] = []
        total_len = 0
        for insight in filtered:
            content = insight.content[: self.MAX_CHARS_PER_INSIGHT]
            if len(insight.content) > self.MAX_CHARS_PER_INSIGHT:
                content += "..."
            cat = _CATEGORY_LABELS.get(insight.category, insight.category)
            entry = f"### [{cat}] {insight.title}\n{content}"

            if total_len + len(entry) > self.MAX_TOTAL_CHARS:
                break
            parts.append(entry)
            total_len += len(entry) + 2  # +2 for "\n\n" separator

        context_text = "\n\n".join(parts)
        self._context_cache[workspace_id] = (time.time(), context_text)
        return context_text

    def invalidate_context_cache(self, workspace_id: str | None = None) -> None:
        """인사이트 컨텍스트 캐시 무효화."""
        if workspace_id:
            self._context_cache.pop(workspace_id, None)
        else:
            self._context_cache.clear()
