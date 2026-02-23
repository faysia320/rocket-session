"""워크플로우 API 엔드포인트."""

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import (
    get_session_manager,
    get_workflow_service,
    get_ws_manager,
)
from app.models.event_types import WsEventType
from app.schemas.workflow import (
    AddAnnotationRequest,
    ApprovePhaseRequest,
    ArtifactAnnotationInfo,
    RequestRevisionRequest,
    SessionArtifactInfo,
    StartWorkflowRequest,
    UpdateAnnotationRequest,
    UpdateArtifactRequest,
    WorkflowStatusResponse,
)
from app.services.session_manager import SessionManager
from app.services.websocket_manager import WebSocketManager
from app.services.workflow_service import WorkflowService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/sessions/{session_id}/workflow",
    tags=["workflow"],
)


@router.post("/start")
async def start_workflow(
    session_id: str,
    req: StartWorkflowRequest,
    manager: SessionManager = Depends(get_session_manager),
    workflow: WorkflowService = Depends(get_workflow_service),
    ws_manager: WebSocketManager = Depends(get_ws_manager),
):
    """워크플로우 시작."""
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    result = await workflow.start_workflow(
        session_id,
        session_manager=manager,
        skip_research=req.skip_research,
        skip_plan=req.skip_plan,
    )

    await ws_manager.broadcast_event(
        session_id,
        {
            "type": WsEventType.WORKFLOW_STARTED,
            "phase": result["phase"],
        },
    )
    return result


@router.get("/status", response_model=WorkflowStatusResponse)
async def get_workflow_status(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
    workflow: WorkflowService = Depends(get_workflow_service),
):
    """워크플로우 상태 조회."""
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    artifacts = await workflow.list_artifacts(session_id)
    return WorkflowStatusResponse(
        workflow_enabled=session.get("workflow_enabled", False),
        workflow_phase=session.get("workflow_phase"),
        workflow_phase_status=session.get("workflow_phase_status"),
        artifacts=artifacts,
    )


@router.get(
    "/artifacts",
    response_model=list[SessionArtifactInfo],
)
async def list_artifacts(
    session_id: str,
    workflow: WorkflowService = Depends(get_workflow_service),
):
    """세션의 모든 아티팩트 조회."""
    return await workflow.list_artifacts(session_id)


@router.get(
    "/artifacts/{artifact_id}",
    response_model=SessionArtifactInfo,
)
async def get_artifact(
    session_id: str,
    artifact_id: int,
    workflow: WorkflowService = Depends(get_workflow_service),
):
    """아티팩트 상세 조회 (주석 포함)."""
    artifact = await workflow.get_artifact(artifact_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="아티팩트를 찾을 수 없습니다")
    return artifact


@router.put(
    "/artifacts/{artifact_id}",
    response_model=SessionArtifactInfo,
)
async def update_artifact(
    session_id: str,
    artifact_id: int,
    req: UpdateArtifactRequest,
    workflow: WorkflowService = Depends(get_workflow_service),
    ws_manager: WebSocketManager = Depends(get_ws_manager),
):
    """아티팩트 본문 직접 편집."""
    artifact = await workflow.update_artifact(artifact_id, req.content)
    if not artifact:
        raise HTTPException(status_code=404, detail="아티팩트를 찾을 수 없습니다")

    await ws_manager.broadcast_event(
        session_id,
        {
            "type": WsEventType.WORKFLOW_ARTIFACT_UPDATED,
            "artifact_id": artifact_id,
        },
    )
    return artifact


@router.post(
    "/artifacts/{artifact_id}/annotations",
    response_model=ArtifactAnnotationInfo,
)
async def add_annotation(
    session_id: str,
    artifact_id: int,
    req: AddAnnotationRequest,
    workflow: WorkflowService = Depends(get_workflow_service),
    ws_manager: WebSocketManager = Depends(get_ws_manager),
):
    """인라인 주석 추가."""
    annotation = await workflow.add_annotation(
        artifact_id=artifact_id,
        line_start=req.line_start,
        line_end=req.line_end,
        content=req.content,
        annotation_type=req.annotation_type,
    )

    await ws_manager.broadcast_event(
        session_id,
        {
            "type": WsEventType.WORKFLOW_ANNOTATION_ADDED,
            "artifact_id": artifact_id,
            "annotation_id": annotation.id,
        },
    )
    return annotation


@router.put(
    "/artifacts/{artifact_id}/annotations/{annotation_id}",
    response_model=ArtifactAnnotationInfo,
)
async def update_annotation(
    session_id: str,
    artifact_id: int,
    annotation_id: int,
    req: UpdateAnnotationRequest,
    workflow: WorkflowService = Depends(get_workflow_service),
):
    """주석 상태 업데이트 (resolve/dismiss)."""
    annotation = await workflow.update_annotation_status(annotation_id, req.status)
    if not annotation:
        raise HTTPException(status_code=404, detail="주석을 찾을 수 없습니다")
    return annotation


@router.post("/approve")
async def approve_phase(
    session_id: str,
    req: ApprovePhaseRequest,
    manager: SessionManager = Depends(get_session_manager),
    workflow: WorkflowService = Depends(get_workflow_service),
    ws_manager: WebSocketManager = Depends(get_ws_manager),
):
    """현재 phase 승인 → 다음 phase 전환."""
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    result = await workflow.approve_phase(session_id, session_manager=manager, feedback=req.feedback)

    event_type = (
        WsEventType.WORKFLOW_COMPLETED
        if result.get("next_phase") is None
        else WsEventType.WORKFLOW_PHASE_APPROVED
    )
    await ws_manager.broadcast_event(
        session_id,
        {
            "type": event_type,
            "phase": result.get("approved_phase"),
            "next_phase": result.get("next_phase"),
        },
    )
    return result


@router.post("/request-revision")
async def request_revision(
    session_id: str,
    req: RequestRevisionRequest,
    manager: SessionManager = Depends(get_session_manager),
    workflow: WorkflowService = Depends(get_workflow_service),
    ws_manager: WebSocketManager = Depends(get_ws_manager),
):
    """수정 요청 → 아티팩트 새 버전 생성."""
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    result = await workflow.request_revision(session_id, session_manager=manager, feedback=req.feedback)

    await ws_manager.broadcast_event(
        session_id,
        {
            "type": WsEventType.WORKFLOW_PHASE_REVISION,
            "phase": result.get("phase"),
        },
    )
    return result
