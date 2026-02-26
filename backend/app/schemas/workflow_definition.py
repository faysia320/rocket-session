"""워크플로우 정의 관련 Pydantic 스키마."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.workflow_node import WorkflowNodeInfo


class WorkflowStepConfig(BaseModel):
    """Definition의 steps JSONB 저장 형식 (node_id 참조)."""

    node_id: str
    order_index: int = 0
    auto_advance: bool = False
    review_required: bool = False


class ResolvedWorkflowStep(BaseModel):
    """Node 정보가 결합된 API 응답용 스키마."""

    node_id: str
    name: str
    label: str
    icon: str
    prompt_template: str
    constraints: str
    order_index: int
    auto_advance: bool
    review_required: bool


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
    steps: list[ResolvedWorkflowStep]
    created_at: datetime
    updated_at: datetime


class WorkflowDefinitionExport(BaseModel):
    """워크플로우 정의 JSON export/import 형식."""

    version: int = 1
    definition: WorkflowDefinitionInfo
    nodes: list[WorkflowNodeInfo] = []
