"""워크스페이스 인사이트 서비스 — 세션 지식 추출 및 관리."""

import logging
import re
from datetime import datetime, timezone

from app.core.database import Database
from app.models.workspace_insight import WorkspaceInsight
from app.repositories.workspace_insight_repo import WorkspaceInsightRepository
from app.schemas.workspace_insight import (
    CreateInsightRequest,
    InsightContextResponse,
    UpdateInsightRequest,
    WorkspaceInsightInfo,
)
from app.services.base import DBService

logger = logging.getLogger(__name__)

# 카테고리별 키워드 패턴 (한국어 + 영어)
_PATTERN_KEYWORDS = [
    "패턴",
    "컨벤션",
    "규칙",
    "convention",
    "pattern",
    "rule",
    "best practice",
    "코딩 스타일",
    "네이밍",
    "naming",
]
_GOTCHA_KEYWORDS = [
    "주의",
    "엣지",
    "edge case",
    "gotcha",
    "함정",
    "pitfall",
    "caveat",
    "조심",
    "caution",
    "warning",
    "주의사항",
    "제약",
    "limitation",
]
_DECISION_KEYWORDS = [
    "결정",
    "선택",
    "접근법",
    "이유",
    "decision",
    "chose",
    "approach",
    "왜",
    "why",
    "trade-off",
    "트레이드오프",
    "architecture",
]


class InsightService(DBService):
    """워크스페이스 인사이트 관리 서비스."""

    def __init__(self, db: Database) -> None:
        super().__init__(db)

    async def extract_from_session(self, session_id: str) -> list[WorkspaceInsightInfo]:
        """세션 완료 시 메시지/아티팩트에서 인사이트 자동 추출.

        전략:
        1. 세션의 workspace_id 확인
        2. approved 아티팩트 우선 분석 (구조화된 고품질 데이터)
        3. file_changes에서 파일 목적 매핑 생성
        4. 기존 인사이트와 중복 체크
        """
        from app.models.file_change import FileChange
        from app.models.session import Session
        from app.models.session_artifact import SessionArtifact
        from app.repositories.session_repo import SessionRepository

        async with self._session_scope(
            SessionRepository, WorkspaceInsightRepository
        ) as (db_session, session_repo, insight_repo):
            # 세션 조회
            sess: Session | None = await session_repo.get_by_id(session_id)
            if not sess or not sess.workspace_id:
                return []

            workspace_id = sess.workspace_id
            now = datetime.now(timezone.utc)

            # 아티팩트 조회 (approved 상태 우선)
            from sqlalchemy import select

            artifact_stmt = (
                select(SessionArtifact)
                .where(SessionArtifact.session_id == session_id)
                .order_by(SessionArtifact.created_at.asc())
            )
            artifact_result = await db_session.execute(artifact_stmt)
            artifacts = list(artifact_result.scalars().all())

            # file_changes 조회
            fc_stmt = select(FileChange).where(FileChange.session_id == session_id)
            fc_result = await db_session.execute(fc_stmt)
            file_changes = list(fc_result.scalars().all())

            # 기존 인사이트 타이틀 (중복 방지용)
            existing = await insight_repo.list_by_workspace(workspace_id, limit=200)
            existing_titles = {i.title.lower().strip() for i in existing}

            new_insights: list[WorkspaceInsight] = []

            # 1. 아티팩트에서 인사이트 추출
            for artifact in artifacts:
                if not artifact.content:
                    continue
                extracted = _extract_insights_from_text(artifact.content)
                for category, title, content in extracted:
                    if title.lower().strip() in existing_titles:
                        continue
                    existing_titles.add(title.lower().strip())
                    new_insights.append(
                        WorkspaceInsight(
                            workspace_id=workspace_id,
                            session_id=session_id,
                            category=category,
                            title=title[:500],
                            content=content[:2000],
                            relevance_score=0.8,
                            is_auto_generated=True,
                            created_at=now,
                            updated_at=now,
                        )
                    )

            # 2. file_changes에서 파일 매핑 인사이트
            if file_changes:
                file_paths = list({fc.file for fc in file_changes if fc.file})
                if file_paths and len(file_paths) <= 20:
                    title = f"세션에서 수정된 파일 ({len(file_paths)}개)"
                    if title.lower().strip() not in existing_titles:
                        new_insights.append(
                            WorkspaceInsight(
                                workspace_id=workspace_id,
                                session_id=session_id,
                                category="file_map",
                                title=title,
                                content="\n".join(
                                    f"- `{fp}`" for fp in file_paths[:20]
                                ),
                                file_paths=file_paths[:20],
                                relevance_score=0.6,
                                is_auto_generated=True,
                                created_at=now,
                                updated_at=now,
                            )
                        )

            # 최대 10개로 제한
            new_insights = new_insights[:10]

            if new_insights:
                await insight_repo.bulk_create(new_insights)
                await db_session.commit()

            return [WorkspaceInsightInfo.model_validate(i) for i in new_insights]

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

    async def build_context_for_session(
        self,
        workspace_id: str,
        prompt: str = "",
        limit: int = 5,
    ) -> InsightContextResponse:
        """프롬프트 기반 관련 인사이트 선택 + 마크다운 컨텍스트 생성."""
        async with self._session_scope(WorkspaceInsightRepository) as (
            _session,
            repo,
        ):
            if prompt:
                keywords = _extract_keywords(prompt)
                items = await repo.search_by_keywords(
                    workspace_id, keywords, limit=limit
                )
            else:
                items = await repo.list_by_workspace(workspace_id, limit=limit)

            insights = [WorkspaceInsightInfo.model_validate(i) for i in items]
            context_text = _format_context_markdown(insights)
            return InsightContextResponse(insights=insights, context_text=context_text)


# ── 내부 헬퍼 ────────────────────────────────────────────────


def _extract_insights_from_text(
    text: str,
) -> list[tuple[str, str, str]]:
    """텍스트에서 인사이트 후보를 추출.

    Returns: list of (category, title, content)
    """
    results: list[tuple[str, str, str]] = []

    # 마크다운 헤더 기반 섹션 분할
    sections = re.split(r"^(#{1,3}\s+.+)$", text, flags=re.MULTILINE)

    for i in range(1, len(sections), 2):
        header = sections[i].strip().lstrip("#").strip()
        body = sections[i + 1].strip() if i + 1 < len(sections) else ""

        if not body or len(body) < 20:
            continue

        combined = f"{header} {body}".lower()
        category = _classify_category(combined)
        if category:
            results.append((category, header, body[:2000]))

    # 섹션이 적으면 리스트 아이템 기반 추출
    if len(results) < 2:
        for line in text.split("\n"):
            line = line.strip()
            if not line.startswith("- ") and not line.startswith("* "):
                continue
            item_text = line.lstrip("-* ").strip()
            if len(item_text) < 15:
                continue
            category = _classify_category(item_text.lower())
            if category:
                title = item_text[:100]
                results.append((category, title, item_text))

    return results[:10]


def _classify_category(text: str) -> str | None:
    """텍스트 내용으로 인사이트 카테고리 분류."""
    text_lower = text.lower()
    for kw in _GOTCHA_KEYWORDS:
        if kw in text_lower:
            return "gotcha"
    for kw in _DECISION_KEYWORDS:
        if kw in text_lower:
            return "decision"
    for kw in _PATTERN_KEYWORDS:
        if kw in text_lower:
            return "pattern"
    return None


def _extract_keywords(prompt: str) -> list[str]:
    """프롬프트에서 검색 키워드 추출 (간단한 토큰화 + stop word 제거)."""
    stop_words = {
        "the",
        "a",
        "an",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
        "shall",
        "can",
        "to",
        "of",
        "in",
        "for",
        "on",
        "with",
        "at",
        "by",
        "from",
        "as",
        "into",
        "through",
        "during",
        "before",
        "after",
        "above",
        "below",
        "between",
        "and",
        "but",
        "or",
        "not",
        "no",
        "this",
        "that",
        "these",
        "those",
        "it",
        "its",
        "이",
        "그",
        "저",
        "의",
        "을",
        "를",
        "에",
        "에서",
        "로",
        "으로",
        "와",
        "과",
        "도",
        "는",
        "은",
        "가",
        "이",
        "하다",
        "있다",
        "되다",
    }
    words = re.findall(r"[a-zA-Z가-힣_]{2,}", prompt)
    return [w for w in words if w.lower() not in stop_words][:10]


def _format_context_markdown(insights: list[WorkspaceInsightInfo]) -> str:
    """인사이트 목록을 마크다운 컨텍스트로 포매팅."""
    if not insights:
        return ""

    sections: dict[str, list[str]] = {}
    category_labels = {
        "pattern": "코드 패턴",
        "gotcha": "주의사항",
        "decision": "결정사항",
        "file_map": "파일 구조",
        "dependency": "의존성",
    }

    for insight in insights:
        label = category_labels.get(insight.category, insight.category)
        sections.setdefault(label, []).append(
            f"- **{insight.title}**: {insight.content[:200]}"
        )

    lines = ["## 워크스페이스 지식 (자동 주입)", ""]
    for label, items in sections.items():
        lines.append(f"### {label}")
        lines.extend(items)
        lines.append("")

    context = "\n".join(lines)
    # 최대 1500자로 제한
    if len(context) > 1500:
        context = context[:1497] + "..."
    return context
