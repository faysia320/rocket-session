"""팀 관련 Pydantic 요청/응답 스키마."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── Response 스키마 ──


class TeamMemberInfo(BaseModel):
    id: int
    team_id: str
    role: str
    nickname: str
    description: str | None = None
    system_prompt: str | None = None
    allowed_tools: str | None = None
    disallowed_tools: str | None = None
    model: str | None = None
    max_turns: int | None = None
    max_budget_usd: float | None = None
    mcp_server_ids: list[str] | None = None
    created_at: datetime
    updated_at: datetime


class TaskSummary(BaseModel):
    total: int = 0
    pending: int = 0
    in_progress: int = 0
    completed: int = 0
    failed: int = 0


class TeamInfo(BaseModel):
    id: str
    name: str
    description: str | None = None
    status: str
    lead_member_id: int | None = None
    config: dict | None = None
    created_at: datetime
    updated_at: datetime
    members: list[TeamMemberInfo] = []
    task_summary: TaskSummary = TaskSummary()


class TeamListItem(BaseModel):
    id: str
    name: str
    description: str | None = None
    status: str
    lead_member_id: int | None = None
    created_at: datetime
    updated_at: datetime
    member_count: int = 0
    task_summary: TaskSummary = TaskSummary()


# ── Request 스키마 ──


class CreateTeamRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    config: Optional[dict] = None


class UpdateTeamRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    status: Optional[Literal["active", "completed", "paused", "archived"]] = None
    config: Optional[dict] = None


class AddTeamMemberRequest(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=50)
    role: Literal["lead", "member"] = "member"
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    allowed_tools: Optional[str] = None
    disallowed_tools: Optional[str] = None
    model: Optional[str] = None
    max_turns: Optional[int] = None
    max_budget_usd: Optional[float] = None
    mcp_server_ids: Optional[list[str]] = None


class UpdateTeamMemberRequest(BaseModel):
    nickname: Optional[str] = Field(None, min_length=1, max_length=50)
    role: Optional[Literal["lead", "member"]] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    allowed_tools: Optional[str] = None
    disallowed_tools: Optional[str] = None
    model: Optional[str] = None
    max_turns: Optional[int] = None
    max_budget_usd: Optional[float] = None
    mcp_server_ids: Optional[list[str]] = None


class SetLeadRequest(BaseModel):
    member_id: int


# ── 태스크 스키마 ──


class TeamTaskInfo(BaseModel):
    id: int
    team_id: str
    title: str
    description: str | None = None
    status: str
    priority: str
    assigned_member_id: int | None = None
    assigned_nickname: str | None = None
    created_by_member_id: int | None = None
    work_dir: str
    session_id: str | None = None
    result_summary: str | None = None
    order_index: int = 0
    depends_on_task_id: int | None = None
    created_at: datetime
    updated_at: datetime


class CreateTaskRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    priority: Literal["low", "medium", "high"] = "medium"
    work_dir: str = Field(..., min_length=1)
    assigned_member_id: Optional[int] = None
    depends_on_task_id: Optional[int] = None


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    status: Optional[
        Literal["pending", "in_progress", "completed", "failed", "cancelled"]
    ] = None
    priority: Optional[Literal["low", "medium", "high"]] = None
    work_dir: Optional[str] = None
    assigned_member_id: Optional[int] = None
    order_index: Optional[int] = None


class ReorderTasksRequest(BaseModel):
    task_ids: list[int] = Field(..., min_length=1)


class CompleteTaskRequest(BaseModel):
    result_summary: Optional[str] = None


class DelegateTaskRequest(BaseModel):
    member_id: Optional[int] = None
    prompt: Optional[str] = None


# ── 메시지 스키마 ──


class TeamMessageInfo(BaseModel):
    id: int
    team_id: str
    from_member_id: int
    to_member_id: int | None = None
    content: str
    message_type: str
    metadata_json: str | None = None
    is_read: bool = False
    created_at: datetime
    from_nickname: str | None = None


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    from_member_id: int
    to_member_id: Optional[int] = None
    message_type: Literal["info", "task_update", "request", "result", "delegate"] = (
        "info"
    )
    metadata_json: Optional[str] = None


class MarkReadRequest(BaseModel):
    message_ids: list[int] = Field(..., min_length=1)
