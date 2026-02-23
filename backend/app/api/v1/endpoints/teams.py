"""팀 관리 REST + WebSocket 엔드포인트."""

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.api.dependencies import (
    get_session_manager,
    get_team_coordinator,
    get_team_message_service,
    get_team_service,
    get_team_task_service,
)
from app.schemas.team import (
    AddTeamMemberRequest,
    CompleteTaskRequest,
    CreateMemberSessionRequest,
    CreateTaskRequest,
    CreateTeamRequest,
    DelegateTaskRequest,
    MarkReadRequest,
    ReorderTasksRequest,
    SendMessageRequest,
    SetLeadRequest,
    TeamInfo,
    TeamListItem,
    TeamMemberInfo,
    TeamMessageInfo,
    TeamTaskInfo,
    UpdateTaskRequest,
    UpdateTeamRequest,
)
from app.services.session_manager import SessionManager
from app.services.team_coordinator import TeamCoordinator
from app.services.team_message_service import TeamMessageService
from app.services.team_service import TeamService
from app.services.team_task_service import TeamTaskService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/teams", tags=["teams"])


# ── 팀 CRUD ──


@router.get("/", response_model=list[TeamListItem])
async def list_teams(
    status: str | None = None,
    service: TeamService = Depends(get_team_service),
):
    return await service.list_teams(status=status)


@router.post("/", response_model=TeamInfo, status_code=201)
async def create_team(
    req: CreateTeamRequest,
    service: TeamService = Depends(get_team_service),
):
    return await service.create_team(
        name=req.name,
        work_dir=req.work_dir,
        description=req.description,
        config=req.config,
    )


@router.get("/{team_id}", response_model=TeamInfo)
async def get_team(
    team_id: str,
    service: TeamService = Depends(get_team_service),
):
    team = await service.get_team(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다")
    return team


@router.patch("/{team_id}", response_model=TeamInfo)
async def update_team(
    team_id: str,
    req: UpdateTeamRequest,
    service: TeamService = Depends(get_team_service),
):
    kwargs = req.model_dump(exclude_unset=True)
    if not kwargs:
        raise HTTPException(status_code=400, detail="변경할 필드가 없습니다")
    team = await service.update_team(team_id, **kwargs)
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다")
    return team


@router.delete("/{team_id}")
async def delete_team(
    team_id: str,
    service: TeamService = Depends(get_team_service),
):
    deleted = await service.delete_team(team_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다")
    return {"status": "deleted"}


# ── 멤버 관리 ──


@router.get("/{team_id}/members", response_model=list[TeamMemberInfo])
async def get_members(
    team_id: str,
    service: TeamService = Depends(get_team_service),
):
    return await service.get_members(team_id)


@router.post("/{team_id}/members", response_model=TeamMemberInfo, status_code=201)
async def add_member(
    team_id: str,
    req: AddTeamMemberRequest,
    service: TeamService = Depends(get_team_service),
):
    try:
        return await service.add_member(
            team_id=team_id,
            session_id=req.session_id,
            role=req.role,
            nickname=req.nickname,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post(
    "/{team_id}/members/create",
    response_model=TeamMemberInfo,
    status_code=201,
)
async def create_member_session(
    team_id: str,
    req: CreateMemberSessionRequest,
    service: TeamService = Depends(get_team_service),
    session_manager: SessionManager = Depends(get_session_manager),
):
    """새 세션을 생성하고 팀 멤버로 추가."""
    team = await service.get_team(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다")

    # 팀의 work_dir 상속하여 세션 생성
    session_data = await session_manager.create(
        work_dir=team.work_dir,
        allowed_tools=req.allowed_tools or "",
        system_prompt=req.system_prompt,
        name=req.nickname,
        model=req.model,
        max_turns=req.max_turns,
    )

    try:
        return await service.add_member(
            team_id=team_id,
            session_id=session_data["id"],
            role=req.role,
            nickname=req.nickname,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{team_id}/members/{session_id}")
async def remove_member(
    team_id: str,
    session_id: str,
    service: TeamService = Depends(get_team_service),
):
    removed = await service.remove_member(team_id, session_id)
    if not removed:
        raise HTTPException(status_code=404, detail="멤버를 찾을 수 없습니다")
    return {"status": "removed"}


@router.patch("/{team_id}/lead", response_model=TeamInfo)
async def set_lead(
    team_id: str,
    req: SetLeadRequest,
    service: TeamService = Depends(get_team_service),
):
    try:
        team = await service.set_lead(team_id, req.session_id)
        if not team:
            raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다")
        return team
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── 팀 상태 ──


@router.get("/{team_id}/status")
async def get_team_status(
    team_id: str,
    service: TeamService = Depends(get_team_service),
):
    team = await service.get_team(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="팀을 찾을 수 없습니다")
    return {
        "team_id": team.id,
        "status": team.status,
        "members": team.members,
        "task_summary": team.task_summary,
    }


# ── 태스크 관리 ──


@router.get("/{team_id}/tasks", response_model=list[TeamTaskInfo])
async def list_tasks(
    team_id: str,
    status: str | None = None,
    service: TeamTaskService = Depends(get_team_task_service),
):
    return await service.list_tasks(team_id, status=status)


@router.post("/{team_id}/tasks", response_model=TeamTaskInfo, status_code=201)
async def create_task(
    team_id: str,
    req: CreateTaskRequest,
    service: TeamTaskService = Depends(get_team_task_service),
):
    return await service.create_task(
        team_id=team_id,
        title=req.title,
        description=req.description,
        priority=req.priority,
        assigned_session_id=req.assigned_session_id,
        depends_on_task_id=req.depends_on_task_id,
    )


@router.get("/{team_id}/tasks/{task_id}", response_model=TeamTaskInfo)
async def get_task(
    team_id: str,
    task_id: int,
    service: TeamTaskService = Depends(get_team_task_service),
):
    task = await service.get_task(task_id)
    if not task or task.team_id != team_id:
        raise HTTPException(status_code=404, detail="태스크를 찾을 수 없습니다")
    return task


@router.patch("/{team_id}/tasks/{task_id}", response_model=TeamTaskInfo)
async def update_task(
    team_id: str,
    task_id: int,
    req: UpdateTaskRequest,
    service: TeamTaskService = Depends(get_team_task_service),
):
    kwargs = req.model_dump(exclude_unset=True)
    if not kwargs:
        raise HTTPException(status_code=400, detail="변경할 필드가 없습니다")
    task = await service.update_task(task_id, **kwargs)
    if not task or task.team_id != team_id:
        raise HTTPException(status_code=404, detail="태스크를 찾을 수 없습니다")
    return task


@router.delete("/{team_id}/tasks/{task_id}")
async def delete_task(
    team_id: str,
    task_id: int,
    service: TeamTaskService = Depends(get_team_task_service),
):
    task = await service.get_task(task_id)
    if not task or task.team_id != team_id:
        raise HTTPException(status_code=404, detail="태스크를 찾을 수 없습니다")
    await service.delete_task(task_id)
    return {"status": "deleted"}


@router.post("/{team_id}/tasks/{task_id}/claim", response_model=TeamTaskInfo)
async def claim_task(
    team_id: str,
    task_id: int,
    session_id: str,
    service: TeamTaskService = Depends(get_team_task_service),
):
    task = await service.claim_task(task_id, session_id)
    if not task:
        raise HTTPException(
            status_code=409, detail="태스크를 선점할 수 없습니다 (이미 할당됨)"
        )
    return task


@router.post("/{team_id}/tasks/{task_id}/complete", response_model=TeamTaskInfo)
async def complete_task(
    team_id: str,
    task_id: int,
    req: CompleteTaskRequest,
    service: TeamTaskService = Depends(get_team_task_service),
):
    task = await service.complete_task(task_id, result_summary=req.result_summary)
    if not task:
        raise HTTPException(status_code=404, detail="태스크를 찾을 수 없습니다")
    return task


@router.post("/{team_id}/tasks/reorder")
async def reorder_tasks(
    team_id: str,
    req: ReorderTasksRequest,
    service: TeamTaskService = Depends(get_team_task_service),
):
    await service.reorder_tasks(team_id, req.task_ids)
    return {"status": "reordered"}


# ── 태스크 위임 ──


@router.post("/{team_id}/tasks/{task_id}/delegate")
async def delegate_task(
    team_id: str,
    task_id: int,
    req: DelegateTaskRequest,
    coordinator: TeamCoordinator = Depends(get_team_coordinator),
):
    """태스크를 특정 세션에 위임하여 실행."""
    try:
        result = await coordinator.delegate_task(
            team_id=team_id,
            task_id=task_id,
            target_session_id=req.target_session_id,
            prompt=req.prompt,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


# ── 팀 메시지 ──


@router.post(
    "/{team_id}/messages",
    response_model=TeamMessageInfo,
    status_code=201,
)
async def send_message(
    team_id: str,
    req: SendMessageRequest,
    from_session_id: str,
    service: TeamMessageService = Depends(get_team_message_service),
    coordinator: TeamCoordinator = Depends(get_team_coordinator),
):
    """팀 메시지 전송."""
    msg = await service.send_message(
        team_id=team_id,
        from_session_id=from_session_id,
        content=req.content,
        to_session_id=req.to_session_id,
        message_type=req.message_type,
        metadata_json=req.metadata_json,
    )
    # 실시간 브로드캐스트
    await coordinator.broadcast_team_event(
        team_id,
        {
            "type": "team_message",
            "message": msg.model_dump(),
        },
    )
    return msg


@router.get("/{team_id}/messages", response_model=list[TeamMessageInfo])
async def list_messages(
    team_id: str,
    after_id: int | None = None,
    limit: int = 50,
    service: TeamMessageService = Depends(get_team_message_service),
):
    """팀 메시지 목록 조회."""
    return await service.list_messages(team_id, after_id=after_id, limit=limit)


@router.post("/{team_id}/messages/read")
async def mark_messages_read(
    team_id: str,
    req: MarkReadRequest,
    service: TeamMessageService = Depends(get_team_message_service),
):
    """메시지 읽음 처리."""
    count = await service.mark_as_read(req.message_ids)
    return {"marked": count}


# ── 팀 대시보드 WebSocket ──


@router.websocket("/ws/{team_id}")
async def team_websocket_endpoint(
    websocket: WebSocket,
    team_id: str,
):
    """팀 대시보드 전용 WebSocket. 팀 이벤트 실시간 수신."""
    coordinator = get_team_coordinator()
    team_service = get_team_service()

    # 팀 존재 확인
    team = await team_service.get_team(team_id)
    if not team:
        await websocket.close(code=4004, reason="팀을 찾을 수 없습니다")
        return

    await websocket.accept()
    coordinator.register_team_ws(team_id, websocket)
    logger.info("팀 %s 대시보드 WS 연결", team_id)

    try:
        # 초기 상태 전송
        await websocket.send_json({
            "type": "team_state",
            "team_id": team_id,
            "status": team.status,
            "member_count": len(team.members),
            "task_summary": team.task_summary.model_dump(),
        })

        # 클라이언트 메시지 수신 루프 (heartbeat + 위임 명령)
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=60)
                data = json.loads(raw)

                msg_type = data.get("type")

                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

                elif msg_type == "delegate":
                    # WebSocket을 통한 위임 명령
                    try:
                        result = await coordinator.delegate_task(
                            team_id=team_id,
                            task_id=data["task_id"],
                            target_session_id=data["target_session_id"],
                            prompt=data.get("prompt"),
                        )
                        await websocket.send_json({
                            "type": "delegate_result",
                            "success": True,
                            **result,
                        })
                    except (ValueError, KeyError) as e:
                        await websocket.send_json({
                            "type": "delegate_result",
                            "success": False,
                            "error": str(e),
                        })

            except asyncio.TimeoutError:
                # 60초 동안 메시지 없으면 ping 전송
                if websocket.client_state == WebSocketState.CONNECTED:
                    try:
                        await websocket.send_json({"type": "ping"})
                    except Exception:
                        break
                else:
                    break

    except WebSocketDisconnect:
        logger.info("팀 %s 대시보드 WS 연결 해제", team_id)
    except Exception as e:
        logger.error("팀 %s 대시보드 WS 오류: %s", team_id, e)
    finally:
        coordinator.unregister_team_ws(team_id, websocket)
