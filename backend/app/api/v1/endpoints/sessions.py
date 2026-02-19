"""세션 CRUD REST 엔드포인트."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse

from app.api.dependencies import get_mcp_service, get_session_manager, get_settings, get_settings_service, get_ws_manager
from app.core.config import Settings
from app.models.session import SessionStatus
from app.schemas.session import CreateSessionRequest, CurrentActivity, SessionInfo, UpdateSessionRequest
from app.services.mcp_service import McpService
from app.services.session_manager import SessionManager
from app.services.settings_service import SettingsService
from app.services.websocket_manager import WebSocketManager

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/", response_model=SessionInfo)
async def create_session(
    req: CreateSessionRequest,
    settings: Settings = Depends(get_settings),
    manager: SessionManager = Depends(get_session_manager),
    settings_service: SettingsService = Depends(get_settings_service),
    mcp_service: McpService = Depends(get_mcp_service),
):
    global_settings = await settings_service.get()
    # work_dir 우선순위: 요청 > 글로벌 > env
    work_dir = (
        req.work_dir or global_settings.get("work_dir") or settings.claude_work_dir
    )

    # MCP 서버: 요청에 없으면 활성화된 모든 MCP 서버를 자동 선택
    mcp_server_ids = req.mcp_server_ids
    if not mcp_server_ids:
        enabled_servers = await mcp_service.list_servers()
        mcp_server_ids = [s.id for s in enabled_servers if s.enabled]

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
        mcp_server_ids=mcp_server_ids if mcp_server_ids else None,
    )
    session_with_counts = await manager.get_with_counts(session["id"]) or session
    return manager.to_info(session_with_counts)


@router.get("/")
async def list_sessions(
    manager: SessionManager = Depends(get_session_manager),
    ws_manager: WebSocketManager = Depends(get_ws_manager),
):
    sessions = await manager.list_all()
    result = []
    for s in sessions:
        info = manager.to_info(s)
        if s.get("status") == "running":
            activity = ws_manager.get_current_activity(s["id"])
            if activity:
                info.current_activity = CurrentActivity(**activity)
        result.append(info)
    return result


@router.get("/{session_id}")
async def get_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
    ws_manager: WebSocketManager = Depends(get_ws_manager),
):
    session = await manager.get_with_counts(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    info = manager.to_info(session)
    if session.get("status") == "running":
        activity = ws_manager.get_current_activity(session_id)
        if activity:
            info.current_activity = CurrentActivity(**activity)
    return info


@router.patch("/{session_id}", response_model=SessionInfo)
async def update_session(
    session_id: str,
    req: UpdateSessionRequest,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
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
        mcp_server_ids=req.mcp_server_ids,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    session_with_counts = await manager.get_with_counts(session_id) or updated
    return manager.to_info(session_with_counts)


@router.get("/{session_id}/history")
async def get_history(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    return await manager.get_history(session_id)


@router.get("/{session_id}/files")
async def get_file_changes(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    return await manager.get_file_changes(session_id)


@router.post("/{session_id}/stop")
async def stop_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    await manager.kill_process(session_id)
    return {"status": "stopped"}


@router.get("/{session_id}/stats")
async def get_session_stats(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
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


@router.get("/{session_id}/export")
async def export_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
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


@router.post("/{session_id}/archive")
async def archive_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    """세션을 보관 처리합니다."""
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    if session.get("status") == SessionStatus.RUNNING:
        await manager.kill_process(session_id)
    await manager.update_status(session_id, SessionStatus.ARCHIVED)
    return {"status": "archived"}


@router.post("/{session_id}/unarchive")
async def unarchive_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    """세션 보관을 해제합니다."""
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    await manager.update_status(session_id, SessionStatus.IDLE)
    return {"status": "idle"}


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    deleted = await manager.delete(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    return {"status": "deleted"}
