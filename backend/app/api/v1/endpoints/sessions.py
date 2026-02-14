"""세션 CRUD REST 엔드포인트."""

import platform
import subprocess

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse

from app.api.dependencies import get_session_manager, get_settings, get_settings_service
from app.core.config import Settings
from app.schemas.session import CreateSessionRequest, SessionInfo, UpdateSessionRequest
from app.services.session_manager import SessionManager
from app.services.settings_service import SettingsService

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/", response_model=SessionInfo)
async def create_session(
    req: CreateSessionRequest,
    settings: Settings = Depends(get_settings),
    manager: SessionManager = Depends(get_session_manager),
    settings_service: SettingsService = Depends(get_settings_service),
):
    global_settings = await settings_service.get()
    # work_dir 우선순위: 요청 > 글로벌 > env
    work_dir = (
        req.work_dir or global_settings.get("work_dir") or settings.claude_work_dir
    )
    session = await manager.create(
        work_dir=work_dir,
        allowed_tools=req.allowed_tools,
        system_prompt=req.system_prompt,
        timeout_seconds=req.timeout_seconds,
        permission_mode=req.permission_mode or False,
        permission_required_tools=req.permission_required_tools,
        model=req.model,
        max_turns=req.max_turns,
        max_budget_usd=req.max_budget_usd,
        system_prompt_mode=req.system_prompt_mode or "replace",
        disallowed_tools=req.disallowed_tools,
    )
    session_with_counts = await manager.get_with_counts(session["id"]) or session
    return manager.to_info(session_with_counts)


@router.get("/")
async def list_sessions(manager: SessionManager = Depends(get_session_manager)):
    sessions = await manager.list_all()
    return [manager.to_info(s) for s in sessions]


@router.get("/{session_id}")
async def get_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get_with_counts(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
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
        name=req.name,
        model=req.model,
        max_turns=req.max_turns,
        max_budget_usd=req.max_budget_usd,
        system_prompt_mode=req.system_prompt_mode,
        disallowed_tools=req.disallowed_tools,
    )
    if not updated:
        raise HTTPException(404, "Session not found")
    session_with_counts = await manager.get_with_counts(session_id) or updated
    return manager.to_info(session_with_counts)


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


@router.get("/{session_id}/stats")
async def get_session_stats(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    stats = await manager.get_session_stats(session_id)
    return stats or {
        "total_messages": 0,
        "total_cost": 0,
        "total_duration_ms": 0,
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "total_cache_creation_tokens": 0,
        "total_cache_read_tokens": 0,
    }


@router.post("/{session_id}/open-terminal")
async def open_terminal(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    work_dir = session["work_dir"]
    system = platform.system()
    try:
        if system == "Windows":
            subprocess.Popen(["wt", "-d", work_dir], shell=True)
        elif system == "Darwin":
            subprocess.Popen(["open", "-a", "Terminal", work_dir])
        else:
            subprocess.Popen(["xterm", "-e", f"cd {work_dir} && bash"], shell=True)
        return {"status": "opened", "work_dir": work_dir}
    except Exception as e:
        raise HTTPException(500, f"터미널 열기 실패: {str(e)}")


@router.get("/{session_id}/export")
async def export_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    history = await manager.get_history(session_id)
    session_name = session.get("name") or session_id
    lines = [f"# {session_name}", ""]
    for msg in history:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        if role == "user":
            lines.append(f"> **User**: {content}")
            lines.append("")
        elif role == "assistant":
            lines.append("**Claude**:")
            lines.append("")
            lines.append(content)
            lines.append("")
        else:
            lines.append(f"```\n{content}\n```")
            lines.append("")
    md_content = "\n".join(lines)
    return PlainTextResponse(
        content=md_content,
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="session-{session_id}.md"'
        },
    )


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    deleted = await manager.delete(session_id)
    if not deleted:
        raise HTTPException(404, "Session not found")
    return {"status": "deleted"}
