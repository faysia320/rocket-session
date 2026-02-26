"""워크플로우 노드 관련 Pydantic 스키마."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class WorkflowNodeInfo(BaseModel):
    """워크플로우 노드 응답."""

    id: str
    name: str
    label: str
    icon: str
    prompt_template: str
    constraints: str
    is_builtin: bool = False
    created_at: datetime
    updated_at: datetime


class CreateWorkflowNodeRequest(BaseModel):
    """워크플로우 노드 생성 요청."""

    name: str = Field(..., min_length=1, pattern=r"^[a-z][a-z0-9_]*$")
    label: str = Field(..., min_length=1)
    icon: str = "FileText"
    prompt_template: str = ""
    constraints: str = "readonly"


class UpdateWorkflowNodeRequest(BaseModel):
    """워크플로우 노드 수정 요청."""

    name: Optional[str] = Field(None, min_length=1, pattern=r"^[a-z][a-z0-9_]*$")
    label: Optional[str] = Field(None, min_length=1)
    icon: Optional[str] = None
    prompt_template: Optional[str] = None
    constraints: Optional[str] = None
