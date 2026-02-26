"""로컬 세션 스캔/import API 엔드포인트."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import (
    get_local_scanner,
    get_session_manager,
    get_workspace_service,
)
from app.schemas.local_session import (
    ImportLocalSessionRequest,
    ImportLocalSessionResponse,
    LocalSessionMeta,
    WorkspaceMatch,
)
from app.services.local_session_scanner import LocalSessionScanner
from app.services.session_manager import SessionManager
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/local-sessions", tags=["local-sessions"])


def _extract_repo_name(cwd: str) -> str:
    """cwd 경로의 마지막 세그먼트(레포명) 추출."""
    if not cwd:
        return ""
    return cwd.rstrip("/\\").replace("\\", "/").rsplit("/", 1)[-1]


def _match_workspace(
    cwd: str,
    workspaces: list[dict],
) -> WorkspaceMatch | None:
    """cwd의 레포명과 워크스페이스 name을 case-insensitive 매칭."""
    repo_name = _extract_repo_name(cwd).lower()
    if not repo_name:
        return None
    for ws in workspaces:
        if ws["name"].lower() == repo_name:
            return WorkspaceMatch(
                workspace_id=ws["id"],
                workspace_name=ws["name"],
                local_path=ws["local_path"],
            )
    return None


@router.get("/", response_model=list[LocalSessionMeta])
async def scan_local_sessions(
    project_dir: str | None = Query(None, description="특정 프로젝트만 스캔"),
    since: str | None = Query(
        None, description="ISO 형식 날짜. 이후 수정된 세션만 조회"
    ),
    scanner: LocalSessionScanner = Depends(get_local_scanner),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
):
    """로컬 Claude Code 세션 목록 스캔."""
    sessions = await scanner.scan(project_dir=project_dir, since=since)

    # ready 워크스페이스 목록으로 자동 매칭
    all_workspaces = await workspace_service.list_all()
    ready_workspaces = [ws for ws in all_workspaces if ws["status"] == "ready"]

    if ready_workspaces:
        # cwd별 매칭 캐시 (동일 cwd 반복 조회 방지)
        match_cache: dict[str, WorkspaceMatch | None] = {}
        for session in sessions:
            cwd = session.cwd
            if cwd not in match_cache:
                match_cache[cwd] = _match_workspace(cwd, ready_workspaces)
            session.matched_workspace = match_cache[cwd]

    return sessions


@router.post("/import", response_model=ImportLocalSessionResponse)
async def import_local_session(
    req: ImportLocalSessionRequest,
    scanner: LocalSessionScanner = Depends(get_local_scanner),
    session_manager: SessionManager = Depends(get_session_manager),
    workspace_service: WorkspaceService = Depends(get_workspace_service),
):
    """로컬 세션을 대시보드로 import."""
    workspace_id: str | None = None
    work_dir_override: str | None = None

    if req.workspace_id:
        ws = await workspace_service.get(req.workspace_id)
        if not ws:
            raise HTTPException(
                status_code=404, detail="워크스페이스를 찾을 수 없습니다"
            )
        if ws["status"] != "ready":
            raise HTTPException(
                status_code=400, detail="워크스페이스가 준비되지 않았습니다"
            )
        workspace_id = req.workspace_id
        work_dir_override = ws["local_path"]

    try:
        return await scanner.import_session(
            session_id=req.session_id,
            project_dir=req.project_dir,
            session_manager=session_manager,
            workspace_id=workspace_id,
            work_dir_override=work_dir_override,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
