"""세션 CRUD REST 엔드포인트."""

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_session_manager, get_settings
from app.core.config import Settings
from app.schemas.session import CreateSessionRequest, SessionInfo
from app.services.session_manager import SessionManager

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/", response_model=SessionInfo)
async def create_session(
    req: CreateSessionRequest,
    settings: Settings = Depends(get_settings),
    manager: SessionManager = Depends(get_session_manager),
):
    work_dir = req.work_dir or settings.claude_work_dir
    session = manager.create(work_dir)
    return manager.to_info(session)


@router.get("/")
async def list_sessions(manager: SessionManager = Depends(get_session_manager)):
    return [manager.to_info(s) for s in manager.list_all()]


@router.get("/{session_id}")
async def get_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = manager.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return manager.to_info(session)


@router.get("/{session_id}/history")
async def get_history(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = manager.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session.history


@router.get("/{session_id}/files")
async def get_file_changes(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = manager.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session.file_changes


@router.post("/{session_id}/stop")
async def stop_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = manager.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    await manager.kill_process(session)
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
