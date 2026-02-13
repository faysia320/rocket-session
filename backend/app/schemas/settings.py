"""글로벌 설정 Pydantic 스키마."""

from typing import Optional

from pydantic import BaseModel


class GlobalSettingsResponse(BaseModel):
    work_dir: Optional[str] = None
    allowed_tools: Optional[str] = None
    system_prompt: Optional[str] = None
    timeout_seconds: Optional[int] = None
    mode: str = "normal"
    permission_mode: bool = False
    permission_required_tools: Optional[list[str]] = None


class UpdateGlobalSettingsRequest(BaseModel):
    work_dir: Optional[str] = None
    allowed_tools: Optional[str] = None
    system_prompt: Optional[str] = None
    timeout_seconds: Optional[int] = None
    mode: Optional[str] = None
    permission_mode: Optional[bool] = None
    permission_required_tools: Optional[list[str]] = None
