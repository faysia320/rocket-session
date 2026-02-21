"""토큰 사용량 분석 서비스."""

import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import PurePosixPath

from app.core.database import Database
from app.repositories.analytics_repo import AnalyticsRepository
from app.schemas.analytics import (
    AnalyticsPeriod,
    AnalyticsResponse,
    DailyTokenUsage,
    ProjectTokenUsage,
    SessionTokenRanking,
    TokenSummary,
)


class AnalyticsService:
    """토큰 사용량 분석 서비스."""

    def __init__(self, db: Database):
        self._db = db

    async def get_analytics(
        self, period: AnalyticsPeriod = AnalyticsPeriod.WEEK
    ) -> AnalyticsResponse:
        start, end = self._resolve_period(period)

        async with self._db.session() as session:
            repo = AnalyticsRepository(session)
            summary_raw, daily_raw, sessions_raw, projects_raw = await asyncio.gather(
                repo.get_summary(start, end),
                repo.get_daily_usage(start, end),
                repo.get_session_ranking(start, end, limit=20),
                repo.get_project_usage(start, end),
            )

        total_tokens = (
            summary_raw.get("total_input_tokens", 0)
            + summary_raw.get("total_output_tokens", 0)
        )
        total_sessions = summary_raw.get("total_sessions", 0)

        summary = TokenSummary(
            total_input_tokens=summary_raw.get("total_input_tokens", 0),
            total_output_tokens=summary_raw.get("total_output_tokens", 0),
            total_cache_read_tokens=summary_raw.get("total_cache_read_tokens", 0),
            total_cache_creation_tokens=summary_raw.get(
                "total_cache_creation_tokens", 0
            ),
            total_sessions=total_sessions,
            total_messages=summary_raw.get("total_messages", 0),
            avg_tokens_per_session=(
                round(total_tokens / total_sessions, 1) if total_sessions > 0 else 0.0
            ),
        )

        daily_usage = [DailyTokenUsage(**row) for row in daily_raw]
        session_ranking = [SessionTokenRanking(**row) for row in sessions_raw]
        project_usage = [
            ProjectTokenUsage(
                work_dir=row["work_dir"],
                project_name=PurePosixPath(row["work_dir"]).name or row["work_dir"],
                input_tokens=row.get("input_tokens", 0),
                output_tokens=row.get("output_tokens", 0),
                cache_read_tokens=row.get("cache_read_tokens", 0),
                cache_creation_tokens=row.get("cache_creation_tokens", 0),
                session_count=row.get("session_count", 0),
            )
            for row in projects_raw
        ]

        return AnalyticsResponse(
            period=period.value,
            start_date=start,
            end_date=end,
            summary=summary,
            daily_usage=daily_usage,
            session_ranking=session_ranking,
            project_usage=project_usage,
        )

    @staticmethod
    def _resolve_period(period: AnalyticsPeriod) -> tuple[str, str]:
        now = datetime.now(timezone.utc)
        end_of_today = (now + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        end = end_of_today.isoformat()

        if period == AnalyticsPeriod.TODAY:
            start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == AnalyticsPeriod.WEEK:
            start_dt = end_of_today - timedelta(days=7)
        elif period == AnalyticsPeriod.MONTH:
            start_dt = end_of_today - timedelta(days=30)
        else:
            start_dt = datetime(1970, 1, 1, tzinfo=timezone.utc)

        return start_dt.isoformat(), end
