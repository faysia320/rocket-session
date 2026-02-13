"""파일시스템 탐색 API 엔드포인트."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_filesystem_service
from app.schemas.filesystem import (
    CreateWorktreeRequest,
    DirectoryListResponse,
    GitInfo,
    WorktreeInfo,
    WorktreeListResponse,
)
from app.services.filesystem_service import FilesystemService

router = APIRouter(prefix="/api/fs", tags=["filesystem"])


@router.get("/list", response_model=DirectoryListResponse)
async def list_directory(
    path: str = Query(default="~", description="탐색할 디렉토리 경로"),
    fs: FilesystemService = Depends(get_filesystem_service),
):
    try:
        return await fs.list_directory(path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")


@router.get("/git-info", response_model=GitInfo)
async def get_git_info(
    path: str = Query(..., description="Git 정보를 조회할 경로"),
    fs: FilesystemService = Depends(get_filesystem_service),
):
    try:
        return await fs.get_git_info(path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/worktrees", response_model=WorktreeListResponse)
async def list_worktrees(
    path: str = Query(..., description="Git 저장소 경로"),
    fs: FilesystemService = Depends(get_filesystem_service),
):
    try:
        return await fs.list_worktrees(path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/worktrees", response_model=WorktreeInfo)
async def create_worktree(
    req: CreateWorktreeRequest,
    fs: FilesystemService = Depends(get_filesystem_service),
):
    try:
        return await fs.create_worktree(
            repo_path=req.repo_path,
            branch=req.branch,
            target_path=req.target_path,
            create_branch=req.create_branch,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
