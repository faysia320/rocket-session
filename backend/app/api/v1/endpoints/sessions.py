"""세션 CRUD REST 엔드포인트."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from app.api.dependencies import (
    get_mcp_service,
    get_search_service,
    get_session_manager,
    get_settings,
    get_settings_service,
    get_tag_service,
    get_template_service,
    get_ws_manager,
)
from app.api.v1.endpoints.permissions import clear_session_trusted
from app.core.config import Settings
from app.models.session import SessionStatus
from app.schemas.search import PaginatedSessionsResponse
from app.schemas.session import (
    CreateSessionRequest,
    CurrentActivity,
    ForkSessionRequest,
    SessionInfo,
    UpdateSessionRequest,
)
from app.schemas.tag import SessionTagRequest, TagInfo
from app.services.mcp_service import McpService
from app.services.search_service import SearchService
from app.services.tag_service import TagService
from app.services.session_manager import SessionManager
from app.services.settings_service import SettingsService
from app.services.template_service import TemplateService
from app.services.websocket_manager import WebSocketManager

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/", response_model=SessionInfo)
async def create_session(
    req: CreateSessionRequest,
    settings: Settings = Depends(get_settings),
    manager: SessionManager = Depends(get_session_manager),
    settings_service: SettingsService = Depends(get_settings_service),
    mcp_service: McpService = Depends(get_mcp_service),
    template_service: TemplateService = Depends(get_template_service),
):
    global_settings = await settings_service.get()

    # 템플릿 적용: template_id가 있으면 템플릿에서 기본값 채움
    tpl = None
    if req.template_id:
        tpl = await template_service.get_template(req.template_id)
        if not tpl:
            raise HTTPException(status_code=404, detail="템플릿을 찾을 수 없습니다")

    # work_dir 우선순위: 요청 > 템플릿 > 글로벌 > env
    work_dir = (
        req.work_dir
        or (tpl.work_dir if tpl else None)
        or global_settings.get("work_dir")
        or settings.claude_work_dir
    )

    # 각 필드 우선순위: 요청값 > 템플릿값
    system_prompt = (
        req.system_prompt
        if req.system_prompt is not None
        else (tpl.system_prompt if tpl else None)
    )
    allowed_tools = (
        req.allowed_tools
        if req.allowed_tools is not None
        else (tpl.allowed_tools if tpl else None)
    )
    disallowed_tools = (
        req.disallowed_tools
        if req.disallowed_tools is not None
        else (tpl.disallowed_tools if tpl else None)
    )
    timeout_seconds = (
        req.timeout_seconds
        if req.timeout_seconds is not None
        else (tpl.timeout_seconds if tpl else None)
    )
    permission_mode = (
        req.permission_mode
        if req.permission_mode is not None
        else (tpl.permission_mode if tpl else False)
    )
    permission_required_tools = (
        req.permission_required_tools
        if req.permission_required_tools is not None
        else (tpl.permission_required_tools if tpl else None)
    )
    model = req.model if req.model is not None else (tpl.model if tpl else None)
    max_turns = (
        req.max_turns if req.max_turns is not None else (tpl.max_turns if tpl else None)
    )
    max_budget_usd = (
        req.max_budget_usd
        if req.max_budget_usd is not None
        else (tpl.max_budget_usd if tpl else None)
    )
    system_prompt_mode = (
        req.system_prompt_mode
        if req.system_prompt_mode is not None
        else (tpl.system_prompt_mode if tpl else "replace")
    )
    mode = req.mode if req.mode is not None else (tpl.mode if tpl else None)

    additional_dirs = (
        req.additional_dirs
        if req.additional_dirs is not None
        else (tpl.additional_dirs if tpl else None)
    )
    fallback_model = (
        req.fallback_model
        if req.fallback_model is not None
        else (tpl.fallback_model if tpl else None)
    )

    # MCP 서버: 요청 > 템플릿 > 활성화된 모든 MCP 서버
    mcp_server_ids = req.mcp_server_ids
    if not mcp_server_ids and tpl and tpl.mcp_server_ids:
        mcp_server_ids = tpl.mcp_server_ids
    if not mcp_server_ids:
        enabled_servers = await mcp_service.list_servers()
        mcp_server_ids = [s.id for s in enabled_servers if s.enabled]

    session = await manager.create(
        work_dir=work_dir,
        allowed_tools=allowed_tools,
        system_prompt=system_prompt,
        timeout_seconds=timeout_seconds,
        permission_mode=permission_mode or False,
        permission_required_tools=permission_required_tools,
        model=model,
        max_turns=max_turns,
        max_budget_usd=max_budget_usd,
        system_prompt_mode=system_prompt_mode or "replace",
        disallowed_tools=disallowed_tools,
        mcp_server_ids=mcp_server_ids if mcp_server_ids else None,
        additional_dirs=additional_dirs,
        fallback_model=fallback_model,
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


@router.get("/search", response_model=PaginatedSessionsResponse)
async def search_sessions(
    q: Optional[str] = Query(None, description="세션 이름/ID 검색 (LIKE)"),
    fts: Optional[str] = Query(None, description="전문 검색 (FTS5, 메시지 내용 포함)"),
    status: Optional[str] = Query(None, description="상태 필터"),
    model: Optional[str] = Query(None, description="모델명 필터"),
    work_dir: Optional[str] = Query(None, description="작업 디렉토리 prefix"),
    tag_ids: Optional[str] = Query(None, description="태그 ID 쉼표 구분 (AND)"),
    date_from: Optional[str] = Query(None, description="시작일 (ISO 8601)"),
    date_to: Optional[str] = Query(None, description="종료일 (ISO 8601)"),
    sort: str = Query("created_at", description="정렬 기준"),
    order: str = Query("desc", description="정렬 방향 (asc/desc)"),
    limit: int = Query(50, ge=1, le=100, description="페이지 크기"),
    offset: int = Query(0, ge=0, description="오프셋"),
    include_tags: bool = Query(False, description="태그 포함 여부"),
    search_service: SearchService = Depends(get_search_service),
):
    """세션 검색/필터/정렬/페이징."""
    parsed_tag_ids = None
    if tag_ids:
        parsed_tag_ids = [t.strip() for t in tag_ids.split(",") if t.strip()]

    return await search_service.search_sessions(
        q=q,
        fts_query=fts,
        status=status,
        model=model,
        work_dir=work_dir,
        tag_ids=parsed_tag_ids,
        date_from=date_from,
        date_to=date_to,
        sort=sort,
        order=order,
        limit=limit,
        offset=offset,
        include_tags=include_tags,
    )


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
    if not await manager.exists(session_id):
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
        additional_dirs=req.additional_dirs,
        fallback_model=req.fallback_model,
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


@router.post("/{session_id}/fork", response_model=SessionInfo)
async def fork_session(
    session_id: str,
    req: ForkSessionRequest = ForkSessionRequest(),
    manager: SessionManager = Depends(get_session_manager),
):
    """세션을 포크합니다. 설정과 메시지를 새 세션으로 복사합니다."""
    result = await manager.fork(session_id, req.message_id)
    if not result:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    return manager.to_info(result)


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
    ws_manager: WebSocketManager = Depends(get_ws_manager),
):
    deleted = await manager.delete(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    # 인메모리 자원 정리 (seq 카운터, 이벤트 버퍼, 세션 신뢰 도구)
    ws_manager.reset_session(session_id)
    clear_session_trusted(session_id)
    return {"status": "deleted"}


# ── 세션-태그 ──────────────────────────────────────────────


@router.post("/{session_id}/tags", response_model=list[TagInfo])
async def add_session_tags(
    session_id: str,
    req: SessionTagRequest,
    manager: SessionManager = Depends(get_session_manager),
    tag_service: TagService = Depends(get_tag_service),
):
    """세션에 태그를 추가합니다."""
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    return await tag_service.add_tags_to_session(session_id, req.tag_ids)


@router.delete("/{session_id}/tags/{tag_id}")
async def remove_session_tag(
    session_id: str,
    tag_id: str,
    manager: SessionManager = Depends(get_session_manager),
    tag_service: TagService = Depends(get_tag_service),
):
    """세션에서 태그를 제거합니다."""
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    removed = await tag_service.remove_tag_from_session(session_id, tag_id)
    if not removed:
        raise HTTPException(status_code=404, detail="세션에 해당 태그가 없습니다")
    return {"status": "removed"}
