"""세션 템플릿 관련 Pydantic 스키마."""

from typing import Literal, Optional

from pydantic import BaseModel, Field


class CreateTemplateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    work_dir: Optional[str] = None
    system_prompt: Optional[str] = None
    allowed_tools: Optional[str] = None
    disallowed_tools: Optional[str] = None
    timeout_seconds: Optional[int] = Field(None, ge=1, le=7200)
    mode: Optional[Literal["normal", "plan"]] = None
    permission_mode: Optional[bool] = None
    permission_required_tools: Optional[list[str]] = None
    model: Optional[str] = None
    max_turns: Optional[int] = Field(None, ge=1, le=1000)
    max_budget_usd: Optional[float] = Field(None, gt=0)
    system_prompt_mode: Optional[Literal["replace", "append"]] = None
    mcp_server_ids: Optional[list[str]] = None
    additional_dirs: Optional[list[str]] = None
    fallback_model: Optional[str] = None


class UpdateTemplateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    work_dir: Optional[str] = None
    system_prompt: Optional[str] = None
    allowed_tools: Optional[str] = None
    disallowed_tools: Optional[str] = None
    timeout_seconds: Optional[int] = Field(None, ge=1, le=7200)
    mode: Optional[Literal["normal", "plan"]] = None
    permission_mode: Optional[bool] = None
    permission_required_tools: Optional[list[str]] = None
    model: Optional[str] = None
    max_turns: Optional[int] = Field(None, ge=1, le=1000)
    max_budget_usd: Optional[float] = Field(None, gt=0)
    system_prompt_mode: Optional[Literal["replace", "append"]] = None
    mcp_server_ids: Optional[list[str]] = None
    additional_dirs: Optional[list[str]] = None
    fallback_model: Optional[str] = None


class TemplateInfo(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    work_dir: Optional[str] = None
    system_prompt: Optional[str] = None
    allowed_tools: Optional[str] = None
    disallowed_tools: Optional[str] = None
    timeout_seconds: Optional[int] = None
    mode: str = "normal"
    permission_mode: bool = False
    permission_required_tools: Optional[list[str]] = None
    model: Optional[str] = None
    max_turns: Optional[int] = None
    max_budget_usd: Optional[float] = None
    system_prompt_mode: str = "replace"
    mcp_server_ids: Optional[list[str]] = None
    additional_dirs: Optional[list[str]] = None
    fallback_model: Optional[str] = None
    created_at: str
    updated_at: str


class CreateTemplateFromSessionRequest(BaseModel):
    """기존 세션에서 템플릿 생성 요청."""

    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class TemplateExport(BaseModel):
    """템플릿 JSON export/import 형식."""

    version: int = 1
    template: TemplateInfo
