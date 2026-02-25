"""워크플로우 관련 Pydantic 스키마."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

WorkflowPhase = Literal["research", "plan", "implement"]
WorkflowPhaseStatus = Literal["in_progress", "awaiting_approval", "approved", "revision_requested"]
ArtifactStatusType = Literal["draft", "review", "approved", "superseded"]
AnnotationType = Literal["comment", "suggestion", "rejection"]
AnnotationStatusType = Literal["pending", "resolved", "dismissed"]


class ArtifactAnnotationInfo(BaseModel):
    """아티팩트 인라인 주석 정보."""

    id: int
    artifact_id: int
    line_start: int
    line_end: Optional[int] = None
    content: str
    annotation_type: AnnotationType
    status: AnnotationStatusType
    created_at: datetime


class SessionArtifactInfo(BaseModel):
    """세션 아티팩트 정보."""

    id: int
    session_id: str
    phase: WorkflowPhase
    title: str
    content: str
    status: ArtifactStatusType
    version: int
    parent_artifact_id: Optional[int] = None
    annotations: list[ArtifactAnnotationInfo] = []
    created_at: datetime
    updated_at: datetime


class StartWorkflowRequest(BaseModel):
    """워크플로우 시작 요청."""

    skip_research: bool = False
    skip_plan: bool = False


class WorkflowStatusResponse(BaseModel):
    """워크플로우 상태 응답."""

    workflow_enabled: bool
    workflow_phase: Optional[WorkflowPhase] = None
    workflow_phase_status: Optional[WorkflowPhaseStatus] = None
    artifacts: list[SessionArtifactInfo] = []


class UpdateArtifactRequest(BaseModel):
    """아티팩트 수정 요청."""

    content: str


class AddAnnotationRequest(BaseModel):
    """인라인 주석 추가 요청."""

    line_start: int = Field(..., ge=1)
    line_end: Optional[int] = Field(None, ge=1)
    content: str = Field(..., min_length=1)
    annotation_type: AnnotationType = "comment"


class UpdateAnnotationRequest(BaseModel):
    """주석 상태 업데이트 요청."""

    status: Literal["resolved", "dismissed"]


class ApprovePhaseRequest(BaseModel):
    """Phase 승인 요청."""

    feedback: Optional[str] = None


class RequestRevisionRequest(BaseModel):
    """수정 요청."""

    feedback: str = Field(..., min_length=1)
