"""Tests for InsightService.build_insight_context()."""

import time

import pytest
import pytest_asyncio

from app.services.insight_service import InsightService, _CATEGORY_LABELS
from app.schemas.workspace_insight import CreateInsightRequest


@pytest_asyncio.fixture
async def svc(db):
    """InsightService fixture."""
    return InsightService(db)


@pytest_asyncio.fixture
async def workspace_id(db):
    """테스트용 워크스페이스 생성 후 ID 반환."""
    from app.models.workspace import Workspace
    from app.core.utils import utc_now

    ws_id = "ws-insight-test"
    async with db.session() as session:
        session.add(
            Workspace(
                id=ws_id,
                name="insight-test",
                repo_url="https://example.com/repo.git",
                local_path="/tmp/insight-test",
                status="ready",
                created_at=utc_now(),
            )
        )
        await session.commit()
    return ws_id


async def _create(svc: InsightService, ws_id: str, **overrides) -> None:
    """인사이트 헬퍼 생성."""
    defaults = {
        "category": "pattern",
        "title": "Test Insight",
        "content": "Test content",
        "tags": [],
        "file_paths": [],
    }
    defaults.update(overrides)
    await svc.create_insight(ws_id, CreateInsightRequest(**defaults))


# ── 기본 동작 ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_build_insight_context_basic(svc, workspace_id):
    """인사이트가 있으면 컨텍스트에 제목/내용이 포함된다."""
    await _create(svc, workspace_id, title="My Pattern", content="Some content")

    ctx = await svc.build_insight_context(workspace_id)

    assert "My Pattern" in ctx
    assert "Some content" in ctx
    assert "### [" in ctx


@pytest.mark.asyncio
async def test_build_insight_context_empty(svc, workspace_id):
    """인사이트가 없으면 빈 문자열을 반환한다."""
    ctx = await svc.build_insight_context(workspace_id)
    assert ctx == ""


# ── 필터링 ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_filters_archived(svc, workspace_id):
    """아카이브된 인사이트는 제외된다."""
    await _create(svc, workspace_id, title="Active")
    await _create(svc, workspace_id, title="Archived")

    # 두 번째 인사이트를 아카이브
    insights = await svc.list_insights(workspace_id)
    archived = [i for i in insights if i.title == "Archived"]
    if archived:
        await svc.archive_insights([archived[0].id])

    ctx = await svc.build_insight_context(workspace_id)

    assert "Active" in ctx
    assert "Archived" not in ctx


@pytest.mark.asyncio
async def test_filters_low_relevance(svc, workspace_id):
    """relevance_score < 0.3인 인사이트는 제외된다."""
    await _create(svc, workspace_id, title="High Relevance")

    # 낮은 relevance 인사이트 직접 생성
    from app.models.workspace_insight import WorkspaceInsight
    from app.core.utils import utc_now

    now = utc_now()
    async with svc._db.session() as session:
        session.add(
            WorkspaceInsight(
                workspace_id=workspace_id,
                category="gotcha",
                title="Low Relevance",
                content="Should be excluded",
                relevance_score=0.1,
                is_auto_generated=False,
                created_at=now,
                updated_at=now,
            )
        )
        await session.commit()
    svc.invalidate_context_cache(workspace_id)

    ctx = await svc.build_insight_context(workspace_id)

    assert "High Relevance" in ctx
    assert "Low Relevance" not in ctx


# ── 정렬 ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_sorted_by_relevance(svc, workspace_id):
    """높은 relevance_score 인사이트가 먼저 나온다."""
    from app.models.workspace_insight import WorkspaceInsight
    from app.core.utils import utc_now

    now = utc_now()
    async with svc._db.session() as session:
        session.add(
            WorkspaceInsight(
                workspace_id=workspace_id,
                category="pattern",
                title="Medium",
                content="medium",
                relevance_score=0.5,
                is_auto_generated=False,
                created_at=now,
                updated_at=now,
            )
        )
        session.add(
            WorkspaceInsight(
                workspace_id=workspace_id,
                category="decision",
                title="Top",
                content="top",
                relevance_score=0.9,
                is_auto_generated=False,
                created_at=now,
                updated_at=now,
            )
        )
        await session.commit()

    ctx = await svc.build_insight_context(workspace_id)

    pos_top = ctx.index("Top")
    pos_medium = ctx.index("Medium")
    assert pos_top < pos_medium


# ── 크기 제한 ────────────────────────────────────────


@pytest.mark.asyncio
async def test_per_insight_truncation(svc, workspace_id):
    """800자 초과 시 ... 추가."""
    long_content = "A" * 1000
    await _create(svc, workspace_id, title="Long", content=long_content)

    ctx = await svc.build_insight_context(workspace_id)

    assert "..." in ctx
    # 원본 1000자 전체가 포함되지 않아야 함
    assert "A" * 1000 not in ctx


@pytest.mark.asyncio
async def test_total_chars_limit(svc, workspace_id):
    """전체 컨텍스트가 MAX_TOTAL_CHARS를 초과하지 않는다."""
    for i in range(20):
        await _create(
            svc, workspace_id, title=f"Insight {i}", content="X" * 500
        )

    ctx = await svc.build_insight_context(workspace_id)

    assert len(ctx) <= svc.MAX_TOTAL_CHARS + 100  # separator 여유


# ── 캐시 ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cache_hit(svc, workspace_id):
    """두 번째 호출은 캐시에서 반환된다."""
    await _create(svc, workspace_id, title="Cached")

    ctx1 = await svc.build_insight_context(workspace_id)
    assert workspace_id in svc._context_cache

    ctx2 = await svc.build_insight_context(workspace_id)
    assert ctx1 == ctx2


@pytest.mark.asyncio
async def test_invalidate_context_cache(svc, workspace_id):
    """캐시 무효화 후 캐시가 비워진다."""
    await _create(svc, workspace_id, title="To Invalidate")
    await svc.build_insight_context(workspace_id)
    assert workspace_id in svc._context_cache

    svc.invalidate_context_cache(workspace_id)
    assert workspace_id not in svc._context_cache


# ── 카테고리 레이블 ────────────────────────────────────


@pytest.mark.asyncio
async def test_category_korean_labels(svc, workspace_id):
    """각 카테고리가 한글 레이블로 표시된다."""
    for cat in _CATEGORY_LABELS:
        await _create(svc, workspace_id, category=cat, title=f"Title-{cat}")

    ctx = await svc.build_insight_context(workspace_id)

    for label in _CATEGORY_LABELS.values():
        assert f"[{label}]" in ctx
