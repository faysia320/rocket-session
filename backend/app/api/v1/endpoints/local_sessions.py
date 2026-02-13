"""로컬 세션 스캔/import API 엔드포인트."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_local_scanner, get_session_manager
from app.schemas.local_session import (
    ImportLocalSessionRequest,
    ImportLocalSessionResponse,
    LocalSessionMeta,
)
from app.services.local_session_scanner import LocalSessionScanner
from app.services.session_manager import SessionManager

router = APIRouter(prefix="/local-sessions", tags=["local-sessions"])


@router.get("/", response_model=list[LocalSessionMeta])
async def scan_local_sessions(
    project_dir: str | None = Query(None, description="특정 프로젝트만 스캔"),
    scanner: LocalSessionScanner = Depends(get_local_scanner),
):
    """로컬 Claude Code 세션 목록 스캔."""
    return await scanner.scan(project_dir=project_dir)


@router.post("/import", response_model=ImportLocalSessionResponse)
async def import_local_session(
    req: ImportLocalSessionRequest,
    scanner: LocalSessionScanner = Depends(get_local_scanner),
    session_manager: SessionManager = Depends(get_session_manager),
):
    """로컬 세션을 대시보드로 import."""
    try:
        return await scanner.import_session(
            session_id=req.session_id,
            project_dir=req.project_dir,
            session_manager=session_manager,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
