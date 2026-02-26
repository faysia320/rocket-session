"""AnalyticsService 통합 테스트.

AnalyticsService의 get_analytics 메서드를 PostgreSQL DB를 사용하여 검증합니다:
- 데이터 없는 경우 빈 응답 구조 검증
- 토큰 스냅샷 데이터가 있는 경우 집계 검증
- 기간별(period) 필터링 검증
"""

import tempfile
from datetime import datetime, timedelta, timezone

import pytest

from app.models.token_snapshot import TokenSnapshot
from app.repositories.token_snapshot_repo import TokenSnapshotRepository
from app.schemas.analytics import (
    AnalyticsPeriod,
    AnalyticsResponse,
    TokenSummary,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _insert_token_snapshot(
    db,
    *,
    session_id: str = "sess-analytics-001",
    work_dir: str = "/tmp/project",
    input_tokens: int = 100,
    output_tokens: int = 50,
    cache_read_tokens: int = 10,
    cache_creation_tokens: int = 5,
    workflow_phase: str | None = None,
    model: str | None = "claude-sonnet-4-20250514",
    timestamp: datetime | None = None,
) -> None:
    """테스트용 토큰 스냅샷을 DB에 직접 삽입한다."""
    if timestamp is None:
        timestamp = datetime.now(timezone.utc)
    async with db.session() as session:
        repo = TokenSnapshotRepository(session)
        snapshot = TokenSnapshot(
            session_id=session_id,
            work_dir=work_dir,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_read_tokens=cache_read_tokens,
            cache_creation_tokens=cache_creation_tokens,
            workflow_phase=workflow_phase,
            model=model,
            timestamp=timestamp,
        )
        await repo.add(snapshot)


# ---------------------------------------------------------------------------
# get_analytics: 데이터 없는 경우
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestGetAnalyticsEmpty:
    """get_analytics: 데이터가 없는 경우 빈 응답 검증."""

    async def test_empty_response_structure(self, analytics_service):
        """데이터가 없으면 올바른 빈 응답 구조를 반환한다."""
        result = await analytics_service.get_analytics(AnalyticsPeriod.WEEK)

        assert isinstance(result, AnalyticsResponse)
        assert result.period == "7d"
        assert result.start_date is not None
        assert result.end_date is not None

    async def test_empty_summary_zeros(self, analytics_service):
        """데이터가 없으면 summary의 모든 값이 0이다."""
        result = await analytics_service.get_analytics(AnalyticsPeriod.WEEK)

        summary = result.summary
        assert isinstance(summary, TokenSummary)
        assert summary.total_input_tokens == 0
        assert summary.total_output_tokens == 0
        assert summary.total_cache_read_tokens == 0
        assert summary.total_cache_creation_tokens == 0
        assert summary.total_sessions == 0
        assert summary.total_messages == 0
        assert summary.avg_tokens_per_session == 0.0

    async def test_empty_lists(self, analytics_service):
        """데이터가 없으면 모든 목록이 비어 있다."""
        result = await analytics_service.get_analytics(AnalyticsPeriod.WEEK)

        assert result.daily_usage == []
        assert result.session_ranking == []
        assert result.project_usage == []
        assert result.phase_usage == []
        assert result.session_phase_usage == []


# ---------------------------------------------------------------------------
# get_analytics: 데이터가 있는 경우
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestGetAnalyticsWithData:
    """get_analytics: 토큰 스냅샷 데이터가 있는 경우 집계 검증."""

    async def test_summary_aggregation(self, analytics_service, db):
        """스냅샷 데이터의 토큰 합계가 summary에 올바르게 집계된다."""
        now = datetime.now(timezone.utc)

        await _insert_token_snapshot(
            db,
            session_id="sess-agg-001",
            input_tokens=100,
            output_tokens=50,
            cache_read_tokens=10,
            cache_creation_tokens=5,
            timestamp=now,
        )
        await _insert_token_snapshot(
            db,
            session_id="sess-agg-001",
            input_tokens=200,
            output_tokens=100,
            cache_read_tokens=20,
            cache_creation_tokens=10,
            timestamp=now,
        )

        result = await analytics_service.get_analytics(AnalyticsPeriod.WEEK)
        summary = result.summary

        assert summary.total_input_tokens == 300
        assert summary.total_output_tokens == 150
        assert summary.total_cache_read_tokens == 30
        assert summary.total_cache_creation_tokens == 15
        assert summary.total_messages == 2
        assert summary.total_sessions == 1  # 동일 session_id

    async def test_avg_tokens_per_session(self, analytics_service, db):
        """avg_tokens_per_session이 올바르게 계산된다."""
        now = datetime.now(timezone.utc)

        # 세션 1: 총 150 토큰 (100 + 50)
        await _insert_token_snapshot(
            db,
            session_id="sess-avg-001",
            input_tokens=100,
            output_tokens=50,
            timestamp=now,
        )
        # 세션 2: 총 300 토큰 (200 + 100)
        await _insert_token_snapshot(
            db,
            session_id="sess-avg-002",
            input_tokens=200,
            output_tokens=100,
            timestamp=now,
        )

        result = await analytics_service.get_analytics(AnalyticsPeriod.WEEK)
        summary = result.summary

        assert summary.total_sessions == 2
        # 총 토큰: 450, 세션 2개 → 평균 225.0
        assert summary.avg_tokens_per_session == 225.0

    async def test_daily_usage_populated(self, analytics_service, db):
        """일별 사용량 목록이 올바르게 생성된다."""
        now = datetime.now(timezone.utc)

        await _insert_token_snapshot(
            db,
            session_id="sess-daily-001",
            input_tokens=100,
            output_tokens=50,
            timestamp=now,
        )

        result = await analytics_service.get_analytics(AnalyticsPeriod.WEEK)

        assert len(result.daily_usage) >= 1
        today_entry = result.daily_usage[-1]
        assert today_entry.input_tokens >= 100
        assert today_entry.output_tokens >= 50

    async def test_session_ranking_populated(self, analytics_service, db):
        """세션별 랭킹 목록이 올바르게 생성된다."""
        now = datetime.now(timezone.utc)

        await _insert_token_snapshot(
            db,
            session_id="sess-rank-001",
            input_tokens=500,
            output_tokens=250,
            work_dir="/tmp/rank-project",
            timestamp=now,
        )

        result = await analytics_service.get_analytics(AnalyticsPeriod.WEEK)

        assert len(result.session_ranking) >= 1
        top = result.session_ranking[0]
        assert top.session_id == "sess-rank-001"
        assert top.input_tokens == 500
        assert top.output_tokens == 250
        assert top.total_tokens == 750

    async def test_project_usage_populated(self, analytics_service, db):
        """프로젝트별 사용량 목록이 올바르게 생성된다."""
        now = datetime.now(timezone.utc)

        await _insert_token_snapshot(
            db,
            session_id="sess-proj-001",
            work_dir="/tmp/project-alpha",
            input_tokens=100,
            output_tokens=50,
            timestamp=now,
        )
        await _insert_token_snapshot(
            db,
            session_id="sess-proj-002",
            work_dir="/tmp/project-alpha",
            input_tokens=200,
            output_tokens=100,
            timestamp=now,
        )

        result = await analytics_service.get_analytics(AnalyticsPeriod.WEEK)

        alpha_projects = [
            p for p in result.project_usage if p.work_dir == "/tmp/project-alpha"
        ]
        assert len(alpha_projects) == 1
        project = alpha_projects[0]
        assert project.input_tokens == 300
        assert project.output_tokens == 150
        assert project.session_count == 2
        assert project.project_name == "project-alpha"

    async def test_multiple_sessions_counted(self, analytics_service, db):
        """서로 다른 session_id는 별도 세션으로 카운트된다."""
        now = datetime.now(timezone.utc)

        for i in range(5):
            await _insert_token_snapshot(
                db,
                session_id=f"sess-multi-{i:03d}",
                input_tokens=10,
                output_tokens=5,
                timestamp=now,
            )

        result = await analytics_service.get_analytics(AnalyticsPeriod.WEEK)
        assert result.summary.total_sessions == 5
        assert result.summary.total_messages == 5


# ---------------------------------------------------------------------------
# get_analytics: 기간별 필터링
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestGetAnalyticsPeriods:
    """get_analytics: 기간(period)에 따른 필터링 검증."""

    async def test_today_period(self, analytics_service, db):
        """today 기간은 오늘 데이터만 포함한다."""
        now = datetime.now(timezone.utc)

        # 오늘 데이터
        await _insert_token_snapshot(
            db,
            session_id="sess-today-001",
            input_tokens=100,
            output_tokens=50,
            timestamp=now,
        )

        result = await analytics_service.get_analytics(AnalyticsPeriod.TODAY)

        assert result.period == "today"
        assert result.summary.total_input_tokens == 100
        assert result.summary.total_sessions == 1

    async def test_week_period_value(self, analytics_service):
        """week 기간의 period 값이 '7d'이다."""
        result = await analytics_service.get_analytics(AnalyticsPeriod.WEEK)
        assert result.period == "7d"

    async def test_month_period_value(self, analytics_service):
        """month 기간의 period 값이 '30d'이다."""
        result = await analytics_service.get_analytics(AnalyticsPeriod.MONTH)
        assert result.period == "30d"

    async def test_all_period_value(self, analytics_service):
        """all 기간의 period 값이 'all'이다."""
        result = await analytics_service.get_analytics(AnalyticsPeriod.ALL)
        assert result.period == "all"

    async def test_old_data_excluded_from_today(self, analytics_service, db):
        """30일 전 데이터는 today 기간에서 제외된다."""
        old_time = datetime.now(timezone.utc) - timedelta(days=30)

        await _insert_token_snapshot(
            db,
            session_id="sess-old-001",
            input_tokens=999,
            output_tokens=999,
            timestamp=old_time,
        )

        result = await analytics_service.get_analytics(AnalyticsPeriod.TODAY)

        assert result.summary.total_input_tokens == 0
        assert result.summary.total_sessions == 0

    async def test_old_data_included_in_all(self, analytics_service, db):
        """오래된 데이터도 all 기간에는 포함된다."""
        old_time = datetime(2020, 1, 1, tzinfo=timezone.utc)

        await _insert_token_snapshot(
            db,
            session_id="sess-all-001",
            input_tokens=123,
            output_tokens=456,
            timestamp=old_time,
        )

        result = await analytics_service.get_analytics(AnalyticsPeriod.ALL)

        assert result.summary.total_input_tokens >= 123
        assert result.summary.total_sessions >= 1


# ---------------------------------------------------------------------------
# get_analytics: Phase별 사용량
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestGetAnalyticsPhaseUsage:
    """get_analytics: workflow_phase별 토큰 사용량 검증."""

    async def test_phase_usage_with_workflow_data(self, analytics_service, db):
        """workflow_phase가 설정된 스냅샷은 phase_usage에 포함된다."""
        now = datetime.now(timezone.utc)

        await _insert_token_snapshot(
            db,
            session_id="sess-phase-001",
            input_tokens=100,
            output_tokens=50,
            workflow_phase="research",
            timestamp=now,
        )
        await _insert_token_snapshot(
            db,
            session_id="sess-phase-001",
            input_tokens=200,
            output_tokens=100,
            workflow_phase="implement",
            timestamp=now,
        )

        result = await analytics_service.get_analytics(AnalyticsPeriod.WEEK)

        assert len(result.phase_usage) >= 2
        phase_names = {p.workflow_phase for p in result.phase_usage}
        assert "research" in phase_names
        assert "implement" in phase_names

    async def test_phase_usage_empty_without_workflow(self, analytics_service, db):
        """workflow_phase가 None인 스냅샷만 있으면 phase_usage가 비어 있다."""
        now = datetime.now(timezone.utc)

        await _insert_token_snapshot(
            db,
            session_id="sess-nophase-001",
            input_tokens=100,
            output_tokens=50,
            workflow_phase=None,
            timestamp=now,
        )

        result = await analytics_service.get_analytics(AnalyticsPeriod.WEEK)

        assert result.phase_usage == []
