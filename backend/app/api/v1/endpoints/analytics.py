"""토큰 사용량 분석 API 엔드포인트."""

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_analytics_service
from app.schemas.analytics import AnalyticsPeriod, AnalyticsResponse
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/", response_model=AnalyticsResponse)
async def get_analytics(
    period: AnalyticsPeriod = Query(default=AnalyticsPeriod.WEEK),
    analytics: AnalyticsService = Depends(get_analytics_service),
) -> AnalyticsResponse:
    """기간별 토큰 사용량 분석 데이터를 반환합니다."""
    return await analytics.get_analytics(period)
