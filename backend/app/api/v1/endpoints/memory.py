"""Claude Code Memory REST 엔드포인트."""

import logging

from fastapi import APIRouter, Depends

from app.api.dependencies import get_claude_memory_service, get_workspace_service
from app.schemas.claude_memory import (
    MemoryContextResponse,
    MemoryFileContent,
    MemoryFileInfo,
)
from app.services.claude_memory_service import ClaudeMemoryService
from app.services.workspace_service import WorkspaceService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workspaces/{workspace_id}/memory", tags=["memory"])


async def _get_local_path(
    workspace_id: str,
    ws_svc: WorkspaceService = Depends(get_workspace_service),
) -> str:
    """workspace_id → local_path 변환."""
    ws = await ws_svc.get(workspace_id)
    local_path = ws.get("local_path", "")
    if not local_path:
        logger.warning("워크스페이스 %s에 local_path가 설정되지 않았습니다.", workspace_id)
    return local_path


@router.get("/files/", response_model=list[MemoryFileInfo])
async def list_memory_files(
    workspace_id: str,
    local_path: str = Depends(_get_local_path),
    svc: ClaudeMemoryService = Depends(get_claude_memory_service),
):
    """워크스페이스의 Claude Memory 파일 목록."""
    return await svc.list_memory_files(local_path)


@router.get("/files/{file_path:path}", response_model=MemoryFileContent)
async def read_memory_file(
    workspace_id: str,
    file_path: str,
    local_path: str = Depends(_get_local_path),
    svc: ClaudeMemoryService = Depends(get_claude_memory_service),
):
    """특정 Memory 파일 내용 읽기."""
    from app.core.exceptions import NotFoundError

    result = await svc.read_memory_file(local_path, file_path)
    if not result:
        raise NotFoundError("요청한 Memory 파일을 찾을 수 없습니다.")
    return result


@router.get("/context/", response_model=MemoryContextResponse)
async def get_memory_context(
    workspace_id: str,
    local_path: str = Depends(_get_local_path),
    svc: ClaudeMemoryService = Depends(get_claude_memory_service),
):
    """컨텍스트 주입용 Memory 요약."""
    return await svc.build_memory_context(local_path)
