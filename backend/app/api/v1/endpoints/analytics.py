"""토큰 사용량 분석 API 엔드포인트."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_analytics_service
from app.schemas.analytics import AnalyticsPeriod, AnalyticsResponse
from app.services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/", response_model=AnalyticsResponse)
async def get_analytics(
    period: AnalyticsPeriod = Query(default=AnalyticsPeriod.WEEK),
    analytics: AnalyticsService = Depends(get_analytics_service),
) -> AnalyticsResponse:
    """기간별 토큰 사용량 분석 데이터를 반환합니다."""
    try:
        return await analytics.get_analytics(period)
    except Exception as e:
        logger.exception("분석 데이터 조회 실패 (period=%s)", period.value)
        raise HTTPException(
            status_code=500, detail=f"분석 데이터 조회 실패: {e}"
        ) from e
