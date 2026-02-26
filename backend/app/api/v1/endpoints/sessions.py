"""세션 CRUD REST 엔드포인트."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from app.api.dependencies import (
    get_git_service,
    get_mcp_service,
    get_search_service,
    get_session_manager,
    get_settings_service,
    get_tag_service,
    get_workflow_definition_service,
    get_workspace_service,
    get_ws_manager,
)
from app.schemas.common import StatusResponse
from app.api.v1.endpoints.pending_questions import clear_pending_question
from app.api.v1.endpoints.permissions import clear_session_trusted
from app.models.session import SessionStatus
from app.schemas.search import PaginatedSessionsResponse
from app.schemas.session import (
    ConvertToWorktreeRequest,
    CreateSessionRequest,
    CurrentActivity,
    ForkSessionRequest,
    SessionInfo,
    UpdateSessionRequest,
)
from app.schemas.tag import SessionTagRequest, TagInfo
from app.services.git_service import GitService
from app.services.mcp_service import McpService
from app.services.search_service import SearchService
from app.services.session_manager import SessionManager
from app.services.settings_service import SettingsService
from app.services.tag_service import TagService
from app.services.websocket_manager import WebSocketManager
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("/", response_model=SessionInfo, status_code=201)
async def create_session(
    req: CreateSessionRequest,
    manager: SessionManager = Depends(get_session_manager),
    settings_service: SettingsService = Depends(get_settings_service),
    mcp_service: McpService = Depends(get_mcp_service),
    git: GitService = Depends(get_git_service),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
):
    global_settings = await settings_service.get()

    # workspace_id 우선순위: 요청 > 글로벌 기본값
    workspace_id = req.workspace_id or global_settings.get("default_workspace_id")
    if not workspace_id:
        raise HTTPException(
            status_code=400,
            detail="워크스페이스를 선택해주세요. 글로벌 설정에서 기본 워크스페이스를 지정하거나 세션 생성 시 워크스페이스를 선택하세요.",
        )
    ws = await workspace_service.get(workspace_id)
    if not ws:
        raise HTTPException(status_code=404, detail="워크스페이스를 찾을 수 없습니다")
    if ws["status"] != "ready":
        raise HTTPException(
            status_code=400, detail="워크스페이스가 준비되지 않았습니다"
        )
    work_dir = ws["local_path"]

    # MCP 서버: 요청값 > 활성화된 모든 MCP 서버
    mcp_server_ids = req.mcp_server_ids
    if not mcp_server_ids:
        enabled_servers = await mcp_service.list_servers()
        mcp_server_ids = [s.id for s in enabled_servers if s.enabled]

    # branch 지정 시 워크트리 생성 전 체크아웃
    if req.branch:
        success, msg = await git.checkout_branch(work_dir, req.branch)
        if not success:
            raise HTTPException(status_code=400, detail=msg)

    # worktree_name이 있으면 워크트리 즉시 생성
    if req.worktree_name and work_dir:
        try:
            await git.create_claude_worktree(work_dir, req.worktree_name)
        except (ValueError, RuntimeError) as e:
            raise HTTPException(status_code=400, detail=str(e))

    # 워크플로우 정의 로드 (선택된 정의 or builtin default)
    def_service = get_workflow_definition_service()
    definition = await def_service.get_or_default(req.workflow_definition_id)
    sorted_steps = sorted(definition.steps, key=lambda s: s.order_index)
    first_phase = sorted_steps[0].name if sorted_steps else "research"

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
        additional_dirs=req.additional_dirs,
        fallback_model=req.fallback_model,
        worktree_name=req.worktree_name,
        workflow_enabled=True,
        workspace_id=workspace_id,
        workflow_definition_id=definition.id,
        workflow_phase=first_phase,
    )
    session_with_counts = await manager.get_with_counts(session["id"]) or session
    return manager.to_info(session_with_counts)


@router.get("/", response_model=list[SessionInfo])
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


@router.get("/{session_id}", response_model=SessionInfo)
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
        work_dir=req.work_dir,
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


@router.post("/{session_id}/stop", response_model=StatusResponse)
async def stop_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    await manager.kill_process(session_id)
    return StatusResponse(status="stopped")


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


@router.post("/{session_id}/fork", response_model=SessionInfo, status_code=201)
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


@router.post("/{session_id}/convert-to-worktree", response_model=SessionInfo)
async def convert_session_to_worktree(
    session_id: str,
    req: ConvertToWorktreeRequest,
    manager: SessionManager = Depends(get_session_manager),
    git: GitService = Depends(get_git_service),
):
    """기존 세션을 Git 워크트리로 전환합니다.

    1. git worktree add로 워크트리를 즉시 생성
    2. 세션에 worktree_name을 설정하여 이후 실행 시 `-w <name>` 플래그 사용
    대화 기록, 파일 변경 이력, claude_session_id 등 모든 컨텍스트가 보존됩니다.
    """
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

    if session.get("status") == SessionStatus.RUNNING:
        raise HTTPException(
            status_code=409,
            detail="실행 중인 세션은 워크트리로 전환할 수 없습니다. 세션을 먼저 중지하세요.",
        )

    if session.get("worktree_name"):
        raise HTTPException(
            status_code=409,
            detail="이미 워크트리가 설정된 세션입니다.",
        )

    work_dir = session.get("work_dir")
    if not work_dir:
        raise HTTPException(
            status_code=400, detail="작업 디렉토리가 설정되지 않은 세션입니다."
        )

    # 1. 워크트리 즉시 생성
    try:
        await git.create_claude_worktree(work_dir, req.worktree_name)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 2. 세션에 worktree_name 저장
    updated = await manager.update_settings(
        session_id=session_id,
        worktree_name=req.worktree_name,
    )
    if not updated:
        raise HTTPException(status_code=500, detail="세션 업데이트에 실패했습니다")

    session_with_counts = await manager.get_with_counts(session_id) or updated
    return manager.to_info(session_with_counts)


@router.post("/{session_id}/archive", response_model=StatusResponse)
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
    return StatusResponse(status="archived")


@router.post("/{session_id}/unarchive", response_model=StatusResponse)
async def unarchive_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
):
    """세션 보관을 해제합니다."""
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    await manager.update_status(session_id, SessionStatus.IDLE)
    return StatusResponse(status="unarchived")


@router.delete("/{session_id}", response_model=StatusResponse)
async def delete_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager),
    ws_manager: WebSocketManager = Depends(get_ws_manager),
):
    deleted = await manager.delete(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
    # 인메모리 자원 정리 (seq 카운터, 이벤트 버퍼, 세션 신뢰 도구, 대기 질문)
    ws_manager.reset_session(session_id)
    clear_session_trusted(session_id)
    clear_pending_question(session_id)
    return StatusResponse(status="deleted")


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


@router.delete("/{session_id}/tags/{tag_id}", response_model=StatusResponse)
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
    return StatusResponse(status="removed")
