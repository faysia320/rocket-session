"""글로벌 설정 REST 엔드포인트."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_settings_service
from app.schemas.settings import GlobalSettingsResponse, UpdateGlobalSettingsRequest
from app.services.settings_service import SettingsService

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/", response_model=GlobalSettingsResponse)
async def get_global_settings(
    service: SettingsService = Depends(get_settings_service),
):
    """글로벌 기본 설정 조회."""
    return await service.get()


@router.patch("/", response_model=GlobalSettingsResponse)
async def update_global_settings(
    req: UpdateGlobalSettingsRequest,
    service: SettingsService = Depends(get_settings_service),
):
    """글로벌 기본 설정 업데이트."""
    return await service.update(
        work_dir=req.work_dir,
        allowed_tools=req.allowed_tools,
        system_prompt=req.system_prompt,
        timeout_seconds=req.timeout_seconds,
        mode=req.mode,
        permission_mode=req.permission_mode,
        permission_required_tools=req.permission_required_tools,
    )
