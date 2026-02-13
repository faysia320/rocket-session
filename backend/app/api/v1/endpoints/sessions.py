"""세션 CRUD REST 엔드포인트."""

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_session_manager, get_settings
from app.core.config import Settings
from app.schemas.session import CreateSessionRequest, SessionInfo, UpdateSessionRequest
from app.services.session_manager import SessionManager

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/", response_model=SessionInfo)
async def create_session(
    req: CreateSessionRequest,
    settings: Settings = Depends(get_settings),
    manager: SessionManager = Depends(get_session_manager),
):
    work_dir = req.work_dir or settings.claude_work_dir
    session = await manager.create(
        work_dir=work_dir,
        allowed_tools=req.allowed_tools,
        system_prompt=req.system_prompt,
        timeout_seconds=req.timeout_seconds,
        permission_mode=req.permission_mode or False,
        permission_required_tools=req.permission_required_tools,
    )
    # create() 반환 dict에는 message_count/file_changes_count가 없으므로 재조회
    sessions = await manager.list_all()
    for s in sessions:
        if s["id"] == session["id"]:
            return manager.to_info(s)
    return manager.to_info(session)


@router.get("/")
async def list_sessions(manager: SessionManager = Depends(get_session_manager)):
    sessions = await manager.list_all()
    return [manager.to_info(s) for s in sessions]


@router.get("/{session_id}")
async def get_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    # 카운트 포함을 위해 list_all에서 찾기
    sessions = await manager.list_all()
    for s in sessions:
        if s["id"] == session_id:
            return manager.to_info(s)
    return manager.to_info(session)


@router.patch("/{session_id}", response_model=SessionInfo)
async def update_session(
    session_id: str,
    req: UpdateSessionRequest,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    updated = await manager.update_settings(
        session_id=session_id,
        allowed_tools=req.allowed_tools,
        system_prompt=req.system_prompt,
        timeout_seconds=req.timeout_seconds,
        mode=req.mode,
        permission_mode=req.permission_mode,
        permission_required_tools=req.permission_required_tools,
    )
    if not updated:
        raise HTTPException(404, "Session not found")
    # 카운트 포함 재조회
    sessions = await manager.list_all()
    for s in sessions:
        if s["id"] == session_id:
            return manager.to_info(s)
    return manager.to_info(updated)


@router.get("/{session_id}/history")
async def get_history(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return await manager.get_history(session_id)


@router.get("/{session_id}/files")
async def get_file_changes(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return await manager.get_file_changes(session_id)


@router.post("/{session_id}/stop")
async def stop_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    await manager.kill_process(session_id)
    return {"status": "stopped"}


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    deleted = await manager.delete(session_id)
    if not deleted:
        raise HTTPException(404, "Session not found")
    return {"status": "deleted"}
