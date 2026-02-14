"""사용량 정보 스키마."""

from pydantic import BaseModel


class PeriodUsage(BaseModel):
    """기간별 사용량 (5시간 블록 / 주간)."""

    utilization: float = 0.0
    resets_at: str | None = None


class UsageInfo(BaseModel):
    """전체 사용량 정보."""

    five_hour: PeriodUsage = PeriodUsage()
    seven_day: PeriodUsage = PeriodUsage()
    available: bool = True
    error: str | None = None
