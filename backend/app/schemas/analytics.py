"""토큰 사용량 분석 응답 스키마."""

from enum import Enum

from pydantic import BaseModel


class AnalyticsPeriod(str, Enum):
    """분석 기간."""

    TODAY = "today"
    WEEK = "7d"
    MONTH = "30d"
    ALL = "all"


class TokenSummary(BaseModel):
    """기간 내 전체 토큰 요약."""

    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cache_read_tokens: int = 0
    total_cache_creation_tokens: int = 0
    total_sessions: int = 0
    total_messages: int = 0
    avg_tokens_per_session: float = 0.0


class DailyTokenUsage(BaseModel):
    """일별 토큰 사용량."""

    date: str
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_creation_tokens: int = 0
    active_sessions: int = 0


class SessionTokenRanking(BaseModel):
    """세션별 토큰 랭킹."""

    session_id: str
    session_name: str | None = None
    work_dir: str
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    message_count: int = 0
    model: str | None = None


class ProjectTokenUsage(BaseModel):
    """프로젝트(work_dir)별 토큰 사용량."""

    work_dir: str
    project_name: str
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_creation_tokens: int = 0
    session_count: int = 0


class AnalyticsResponse(BaseModel):
    """전체 분석 응답."""

    period: str
    start_date: str
    end_date: str
    summary: TokenSummary
    daily_usage: list[DailyTokenUsage]
    session_ranking: list[SessionTokenRanking]
    project_usage: list[ProjectTokenUsage]
