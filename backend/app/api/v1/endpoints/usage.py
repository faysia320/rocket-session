"""사용량 조회 API."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_usage_service
from app.schemas.usage import UsageInfo
from app.services.usage_service import UsageService

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("/", response_model=UsageInfo)
async def get_usage(
    usage_service: UsageService = Depends(get_usage_service),
) -> UsageInfo:
    """현재 사용량 정보를 반환합니다."""
    return await usage_service.get_usage()
