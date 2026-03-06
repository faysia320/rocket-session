"""워크플로우 API 엔드포인트."""

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import (
    get_claude_runner,
    get_mcp_service,
    get_session_manager,
    get_settings,
    get_settings_service,
    get_validation_service,
    get_workflow_definition_service,
    get_workflow_service,
    get_workspace_service,
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
from app.services.claude_runner import ClaudeRunner, _auto_chain_done, _validation_retry_counts
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
    await manager.get(session_id)  # 존재 확인 (NotFoundError 발생)

    result = await workflow.start_workflow(
        session_id,
        session_manager=manager,
        workflow_definition_id=req.workflow_definition_id,
        start_from_step=req.start_from_step,
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
    def_service=Depends(get_workflow_definition_service),
):
    """워크플로우 상태 조회."""
    session = await manager.get(session_id)

    artifacts = await workflow.list_artifacts(session_id)
    def_id = session.get("workflow_definition_id")
    definition = await def_service.get_or_default(def_id)
    steps_data = [s.model_dump() for s in definition.steps]
    return WorkflowStatusResponse(
        workflow_enabled=session.get("workflow_enabled", False),
        workflow_phase=session.get("workflow_phase"),
        workflow_phase_status=session.get("workflow_phase_status"),
        workflow_definition_id=def_id,
        steps=steps_data,
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
    if not artifact or artifact.session_id != session_id:
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
    existing = await workflow.get_artifact(artifact_id)
    if not existing or existing.session_id != session_id:
        raise HTTPException(status_code=404, detail="아티팩트를 찾을 수 없습니다")
    artifact = await workflow.update_artifact(artifact_id, req.content)

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
    existing = await workflow.get_artifact(artifact_id)
    if not existing or existing.session_id != session_id:
        raise HTTPException(status_code=404, detail="아티팩트를 찾을 수 없습니다")
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
    existing = await workflow.get_artifact(artifact_id)
    if not existing or existing.session_id != session_id:
        raise HTTPException(status_code=404, detail="아티팩트를 찾을 수 없습니다")
    return await workflow.update_annotation_status(annotation_id, req.status)


@router.post("/approve")
async def approve_phase(
    session_id: str,
    req: ApprovePhaseRequest,
    manager: SessionManager = Depends(get_session_manager),
    workflow: WorkflowService = Depends(get_workflow_service),
    ws_manager: WebSocketManager = Depends(get_ws_manager),
    runner: ClaudeRunner = Depends(get_claude_runner),
    mcp_service=Depends(get_mcp_service),
    settings=Depends(get_settings),
    settings_service=Depends(get_settings_service),
    validation_service=Depends(get_validation_service),
    workspace_service=Depends(get_workspace_service),
):
    """현재 phase 승인 → 다음 phase 전환 (Plan→Implement 자동 실행)."""
    session = await manager.get(session_id)

    # ── Validation Pipeline: run_validation=True인 단계에서 검증 실행 ──
    if not req.force:
        current_phase = session.get("workflow_phase")
        def_id = session.get("workflow_definition_id")
        if current_phase and def_id:
            from app.api.dependencies import get_workflow_definition_service

            def_service = get_workflow_definition_service()
            definition = await def_service.get_or_default(def_id)
            current_step = next(
                (s for s in definition.steps if s.name == current_phase), None
            )
            if current_step and current_step.run_validation:
                workspace_id = session.get("workspace_id")
                work_dir = session.get("work_dir", "")
                if workspace_id and work_dir:
                    validation_result = await validation_service.run_validation(
                        workspace_id, "phase_complete", work_dir
                    )
                    if not validation_result.passed:
                        return {
                            "validation_failed": True,
                            "validation_result": validation_result.model_dump(),
                        }

    result = await workflow.approve_phase(
        session_id, session_manager=manager, feedback=req.feedback
    )

    # 승인 성공 시 검증 재시도 카운터 리셋
    _validation_retry_counts.pop(session_id, None)

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

    # 승인 후 다음 phase 자동 실행 (definition 기반)
    next_phase = result.get("next_phase")
    approved_phase = result.get("approved_phase")
    if next_phase:
        try:
            # 다음 step config 조회
            from app.api.dependencies import get_workflow_definition_service

            def_service = get_workflow_definition_service()
            def_id = session.get("workflow_definition_id")
            definition = await def_service.get_or_default(def_id)
            steps = sorted(definition.steps, key=lambda s: s.order_index)
            next_step = next((s for s in steps if s.name == next_phase), None)

            # 승인 → 다음 phase 자동 실행
            original_prompt = session.get("workflow_original_prompt", "")
            next_context = await workflow.build_phase_context(
                session_id, next_phase, original_prompt, session_manager=manager
            )

            global_settings = await settings_service.get()
            allowed_tools = (
                session.get("allowed_tools")
                or global_settings.get("allowed_tools")
                or settings.claude_allowed_tools
            )

            updated = await manager.get(session_id)

            await ws_manager.broadcast_event(
                session_id,
                {
                    "type": WsEventType.WORKFLOW_AUTO_CHAIN,
                    "from_phase": approved_phase,
                    "to_phase": next_phase,
                },
            )

            task = asyncio.create_task(
                runner.run(
                    updated,
                    next_context,
                    allowed_tools,
                    session_id,
                    ws_manager,
                    manager,
                    mcp_service=mcp_service,
                    workflow_phase=next_phase,
                    workflow_service=workflow,
                    original_prompt=original_prompt,
                    workflow_step_config=(
                        next_step.model_dump() if next_step else None
                    ),
                )
            )
            task.add_done_callback(lambda t: _auto_chain_done(t, session_id, manager))
            manager.set_runner_task(session_id, task)
        except Exception:
            logger.warning(
                "세션 %s: %s→%s 자동 실행 실패",
                session_id,
                approved_phase,
                next_phase,
                exc_info=True,
            )

    return result


@router.post("/request-revision")
async def request_revision(
    session_id: str,
    req: RequestRevisionRequest,
    manager: SessionManager = Depends(get_session_manager),
    workflow: WorkflowService = Depends(get_workflow_service),
    ws_manager: WebSocketManager = Depends(get_ws_manager),
    runner: ClaudeRunner = Depends(get_claude_runner),
    mcp_service=Depends(get_mcp_service),
    settings=Depends(get_settings),
    settings_service=Depends(get_settings_service),
):
    """수정 요청 → Plan 자동 재실행."""
    session = await manager.get(session_id)

    result = await workflow.request_revision(
        session_id, session_manager=manager, feedback=req.feedback or ""
    )
    current_phase = result.get("phase")

    await ws_manager.broadcast_event(
        session_id,
        {
            "type": WsEventType.WORKFLOW_PHASE_REVISION,
            "phase": current_phase,
        },
    )

    # review_required step → 자동 재실행
    if current_phase:
        try:
            from app.api.dependencies import get_workflow_definition_service

            def_service = get_workflow_definition_service()
            def_id = session.get("workflow_definition_id")
            definition = await def_service.get_or_default(def_id)
            steps = sorted(definition.steps, key=lambda s: s.order_index)
            current_step = next((s for s in steps if s.name == current_phase), None)

            if current_step and current_step.review_required:
                original_prompt = session.get("workflow_original_prompt", "")
                revision_context = await workflow.build_revision_context(
                    session_id,
                    original_prompt,
                    req.feedback or "",
                    session_manager=manager,
                    validation_summary=req.validation_summary,
                )

                global_settings = await settings_service.get()
                allowed_tools = (
                    session.get("allowed_tools")
                    or global_settings.get("allowed_tools")
                    or settings.claude_allowed_tools
                )

                updated = await manager.get(session_id)

                task = asyncio.create_task(
                    runner.run(
                        updated,
                        revision_context,
                        allowed_tools,
                        session_id,
                        ws_manager,
                        manager,
                        mcp_service=mcp_service,
                        workflow_phase=current_phase,
                        workflow_service=workflow,
                        original_prompt=original_prompt,
                        workflow_step_config=current_step.model_dump(),
                    )
                )
                task.add_done_callback(
                    lambda t: _auto_chain_done(t, session_id, manager)
                )
                manager.set_runner_task(session_id, task)
        except Exception:
            logger.warning(
                "세션 %s: %s 수정 자동 재실행 실패",
                session_id,
                current_phase,
                exc_info=True,
            )

    return result


@router.post("/validate")
async def run_validation(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
    validation_service=Depends(get_validation_service),
):
    """워크스페이스 검증 명령을 수동으로 실행한다."""
    session = await manager.get(session_id)
    workspace_id = session.get("workspace_id")
    work_dir = session.get("work_dir", "")

    if not workspace_id or not work_dir:
        raise HTTPException(
            status_code=400, detail="워크스페이스가 연결되지 않은 세션입니다"
        )

    result = await validation_service.run_validation(workspace_id, "manual", work_dir)
    return result.model_dump()
