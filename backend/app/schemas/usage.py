"""사용량 정보 스키마."""

from pydantic import BaseModel


class BlockUsage(BaseModel):
    """5시간 블록 사용량."""

    total_tokens: int = 0
    cost_usd: float = 0.0
    is_active: bool = False
    time_remaining: str = ""
    burn_rate: int = 0


class WeeklyUsage(BaseModel):
    """주간 사용량."""

    total_tokens: int = 0
    cost_usd: float = 0.0
    models_used: list[str] = []


class UsageInfo(BaseModel):
    """전체 사용량 정보."""

    plan: str = "Max"
    account_id: str = ""
    block_5h: BlockUsage = BlockUsage()
    weekly: WeeklyUsage = WeeklyUsage()
    available: bool = True
    error: str | None = None
