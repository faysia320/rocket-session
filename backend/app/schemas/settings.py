"""글로벌 설정 Pydantic 스키마."""

from typing import Optional

from pydantic import BaseModel


class GlobalSettingsResponse(BaseModel):
    default_workspace_id: Optional[str] = None
    allowed_tools: Optional[str] = None
    system_prompt: Optional[str] = None
    timeout_seconds: Optional[int] = None
    permission_mode: bool = False
    permission_required_tools: Optional[list[str]] = None
    model: Optional[str] = None
    max_turns: Optional[int] = None
    max_budget_usd: Optional[float] = None
    system_prompt_mode: str = "replace"
    disallowed_tools: Optional[str] = None
    mcp_server_ids: Optional[list[str]] = None
    default_additional_workspace_ids: Optional[list[str]] = None
    fallback_model: Optional[str] = None
    globally_trusted_tools: Optional[list[str]] = None


class UpdateGlobalSettingsRequest(BaseModel):
    default_workspace_id: Optional[str] = None
    allowed_tools: Optional[str] = None
    system_prompt: Optional[str] = None
    timeout_seconds: Optional[int] = None
    permission_mode: Optional[bool] = None
    permission_required_tools: Optional[list[str]] = None
    model: Optional[str] = None
    max_turns: Optional[int] = None
    max_budget_usd: Optional[float] = None
    system_prompt_mode: Optional[str] = None
    disallowed_tools: Optional[str] = None
    mcp_server_ids: Optional[list[str]] = None
    default_additional_workspace_ids: Optional[list[str]] = None
    fallback_model: Optional[str] = None
    globally_trusted_tools: Optional[list[str]] = None
