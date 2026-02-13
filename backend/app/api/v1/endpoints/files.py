"""파일 내용 조회 엔드포인트."""

import asyncio
import subprocess
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse

from app.api.dependencies import get_session_manager
from app.services.session_manager import SessionManager

router = APIRouter(prefix="/sessions", tags=["files"])

# 파일 크기 제한 (1MB)
MAX_FILE_SIZE = 1 * 1024 * 1024


def _resolve_safe_path(file_path: str, work_dir: Path) -> Path:
    """파일 경로를 work_dir 기준으로 안전하게 해석한다.

    절대 경로가 들어와도 work_dir 하위인지 검증하고,
    상대 경로는 work_dir 기준으로 결합한다.
    Path traversal 공격을 방지한다.
    """
    resolved_work_dir = work_dir.resolve()
    path = Path(file_path)

    if path.is_absolute():
        # 절대 경로: work_dir 기준 상대 경로로 변환 시도
        resolved = path.resolve()
        try:
            rel = resolved.relative_to(resolved_work_dir)
        except ValueError:
            raise HTTPException(403, "접근 금지: 작업 디렉토리 외부 경로입니다")
        return resolved_work_dir / rel
    else:
        # 상대 경로: work_dir과 결합 후 검증
        resolved = (resolved_work_dir / path).resolve()
        try:
            resolved.relative_to(resolved_work_dir)
        except ValueError:
            raise HTTPException(403, "접근 금지: 작업 디렉토리 외부 경로입니다")
        return resolved


@router.get("/{session_id}/file-content/{file_path:path}")
async def get_file_content(
    session_id: str,
    file_path: str,
    manager: SessionManager = Depends(get_session_manager),
):
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    work_dir = Path(session["work_dir"])
    target = _resolve_safe_path(file_path, work_dir)

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


@router.get("/{session_id}/file-diff/{file_path:path}")
async def get_file_diff(
    session_id: str,
    file_path: str,
    manager: SessionManager = Depends(get_session_manager),
):
    """파일의 git diff를 조회합니다."""
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    work_dir = Path(session["work_dir"])
    target = _resolve_safe_path(file_path, work_dir)
    # git diff에는 work_dir 기준 상대 경로 사용
    resolved_work_dir = work_dir.resolve()
    rel_path = str(target.relative_to(resolved_work_dir))

    async def run_git_diff() -> str:
        def _run() -> str:
            # 먼저 HEAD 대비 변경사항 확인 (staged + unstaged)
            try:
                result = subprocess.run(
                    ["git", "diff", "HEAD", "--", rel_path],
                    cwd=str(work_dir),
                    capture_output=True,
                    text=True,
                    timeout=10.0,
                )
                if result.returncode == 0 and result.stdout.strip():
                    return result.stdout
            except (subprocess.TimeoutExpired, FileNotFoundError):
                pass

            # HEAD diff가 없으면 unstaged 변경사항 확인
            try:
                result = subprocess.run(
                    ["git", "diff", "--", rel_path],
                    cwd=str(work_dir),
                    capture_output=True,
                    text=True,
                    timeout=10.0,
                )
                if result.returncode == 0 and result.stdout.strip():
                    return result.stdout
            except (subprocess.TimeoutExpired, FileNotFoundError):
                pass

            # staged 변경사항 확인
            try:
                result = subprocess.run(
                    ["git", "diff", "--cached", "--", rel_path],
                    cwd=str(work_dir),
                    capture_output=True,
                    text=True,
                    timeout=10.0,
                )
                if result.returncode == 0 and result.stdout.strip():
                    return result.stdout
            except (subprocess.TimeoutExpired, FileNotFoundError):
                pass

            return ""

        return await asyncio.to_thread(_run)

    diff_text = await run_git_diff()

    if not diff_text:
        return PlainTextResponse("", status_code=204)

    return PlainTextResponse(diff_text)


# 업로드 허용 MIME 타입
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/{session_id}/upload")
async def upload_file(
    session_id: str,
    file: UploadFile = File(...),
    manager: SessionManager = Depends(get_session_manager),
):
    """세션에 이미지 파일을 업로드합니다."""
    session = await manager.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    # MIME 타입 검증
    content_type = file.content_type or ""
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            415,
            f"지원하지 않는 파일 형식입니다: {content_type}. "
            f"허용: {', '.join(ALLOWED_IMAGE_TYPES)}"
        )

    # 파일 크기 검증
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "파일이 너무 큽니다 (최대 10MB)")

    # 확장자 화이트리스트 검증 (경로 조작 방지)
    ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
    safe_name = Path(file.filename or "image").name  # 경로 구분자 제거
    ext = Path(safe_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".png"
    upload_dir = Path(tempfile.gettempdir()) / "rocket-session-uploads" / session_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{uuid.uuid4().hex[:8]}{ext}"
    file_path = upload_dir / file_name
    file_path.write_bytes(content)

    return {"path": str(file_path), "name": file.filename, "size": len(content)}
