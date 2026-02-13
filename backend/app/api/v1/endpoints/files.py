"""파일 내용 조회 엔드포인트."""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse

from app.api.dependencies import get_session_manager
from app.services.session_manager import SessionManager

router = APIRouter(prefix="/sessions", tags=["files"])

# 파일 크기 제한 (1MB)
MAX_FILE_SIZE = 1 * 1024 * 1024


@router.get("/{session_id}/file-content/{file_path:path}")
async def get_file_content(
    session_id: str,
    file_path: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    work_dir = Path(session["work_dir"]).resolve()
    target = (work_dir / file_path).resolve()

    # Path traversal 방지: 대상이 work_dir 하위인지 검증
    try:
        target.relative_to(work_dir)
    except ValueError:
        raise HTTPException(403, "접근 금지: 작업 디렉토리 외부 경로입니다")

    if not target.exists():
        raise HTTPException(404, "파일을 찾을 수 없습니다")

    if not target.is_file():
        raise HTTPException(400, "디렉토리는 조회할 수 없습니다")

    if target.stat().st_size > MAX_FILE_SIZE:
        raise HTTPException(413, "파일이 너무 큽니다 (최대 1MB)")

    try:
        content = target.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(415, "바이너리 파일은 표시할 수 없습니다")

    return PlainTextResponse(content)
