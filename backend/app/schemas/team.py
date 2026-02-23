"""팀 관련 Pydantic 요청/응답 스키마."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── Response 스키마 ──


class TeamMemberInfo(BaseModel):
    id: int
    team_id: str
    session_id: str
    role: str
    nickname: str | None = None
    joined_at: str
    session_status: str | None = None
    session_name: str | None = None


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
    lead_session_id: str | None = None
    work_dir: str
    config: dict | None = None
    created_at: str
    updated_at: str
    members: list[TeamMemberInfo] = []
    task_summary: TaskSummary = TaskSummary()


class TeamListItem(BaseModel):
    id: str
    name: str
    description: str | None = None
    status: str
    lead_session_id: str | None = None
    work_dir: str
    created_at: str
    updated_at: str
    member_count: int = 0
    task_summary: TaskSummary = TaskSummary()


# ── Request 스키마 ──


class CreateTeamRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    work_dir: str = Field(..., min_length=1)
    description: Optional[str] = None
    config: Optional[dict] = None


class UpdateTeamRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    status: Optional[Literal["active", "completed", "paused", "archived"]] = None
    config: Optional[dict] = None


class AddTeamMemberRequest(BaseModel):
    session_id: str
    role: Literal["lead", "member"] = "member"
    nickname: Optional[str] = Field(None, max_length=50)


class CreateMemberSessionRequest(BaseModel):
    nickname: Optional[str] = Field(None, max_length=50)
    role: Literal["lead", "member"] = "member"
    allowed_tools: Optional[str] = None
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    max_turns: Optional[int] = None


class SetLeadRequest(BaseModel):
    session_id: str


# ── 태스크 스키마 ──


class TeamTaskInfo(BaseModel):
    id: int
    team_id: str
    title: str
    description: str | None = None
    status: str
    priority: str
    assigned_session_id: str | None = None
    assigned_nickname: str | None = None
    created_by_session_id: str | None = None
    result_summary: str | None = None
    order_index: int = 0
    depends_on_task_id: int | None = None
    created_at: str
    updated_at: str


class CreateTaskRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    priority: Literal["low", "medium", "high"] = "medium"
    assigned_session_id: Optional[str] = None
    depends_on_task_id: Optional[int] = None


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    status: Optional[
        Literal["pending", "in_progress", "completed", "failed", "cancelled"]
    ] = None
    priority: Optional[Literal["low", "medium", "high"]] = None
    assigned_session_id: Optional[str] = None
    order_index: Optional[int] = None


class ReorderTasksRequest(BaseModel):
    task_ids: list[int] = Field(..., min_length=1)


class CompleteTaskRequest(BaseModel):
    result_summary: Optional[str] = None


class DelegateTaskRequest(BaseModel):
    target_session_id: str
    prompt: Optional[str] = None


# ── 메시지 스키마 ──


class TeamMessageInfo(BaseModel):
    id: int
    team_id: str
    from_session_id: str
    to_session_id: str | None = None
    content: str
    message_type: str
    metadata_json: str | None = None
    is_read: bool = False
    created_at: str
    from_nickname: str | None = None


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    to_session_id: Optional[str] = None
    message_type: Literal[
        "info", "task_update", "request", "result", "delegate"
    ] = "info"
    metadata_json: Optional[str] = None


class MarkReadRequest(BaseModel):
    message_ids: list[int] = Field(..., min_length=1)
