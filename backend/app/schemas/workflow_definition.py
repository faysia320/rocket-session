"""워크플로우 정의 관련 Pydantic 스키마."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class WorkflowStepConfig(BaseModel):
    """워크플로우 단계 설정 (노드 속성 인라인 포함)."""

    name: str
    label: str
    icon: str = "FileText"
    prompt_template: str = ""
    constraints: str = "readonly"
    order_index: int = 0
    auto_advance: bool = False
    review_required: bool = False


# 하위 호환용 별칭 — 기존 코드에서 ResolvedWorkflowStep을 참조하는 곳 대응
ResolvedWorkflowStep = WorkflowStepConfig


class CreateWorkflowDefinitionRequest(BaseModel):
    """워크플로우 정의 생성 요청."""

    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    steps: list[WorkflowStepConfig] = Field(..., min_length=1)


class UpdateWorkflowDefinitionRequest(BaseModel):
    """워크플로우 정의 수정 요청."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    steps: Optional[list[WorkflowStepConfig]] = Field(None, min_length=1)


class WorkflowDefinitionInfo(BaseModel):
    """워크플로우 정의 응답."""

    id: str
    name: str
    description: Optional[str] = None
    is_builtin: bool = False
    steps: list[WorkflowStepConfig]
    created_at: datetime
    updated_at: datetime


class WorkflowDefinitionExport(BaseModel):
    """워크플로우 정의 JSON export/import 형식."""

    version: int = 1
    definition: WorkflowDefinitionInfo
