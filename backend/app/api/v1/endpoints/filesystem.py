"""파일시스템 탐색 API 엔드포인트."""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from app.api.dependencies import get_filesystem_service
from app.schemas.filesystem import (
    CreateWorktreeRequest,
    DirectoryListResponse,
    GitHubCLIStatus,
    GitHubPRDetail,
    GitHubPRListResponse,
    GitInfo,
    GitLogResponse,
    GitStatusResponse,
    SkillListResponse,
    WorktreeInfo,
    WorktreeListResponse,
)
from app.services.filesystem_service import FilesystemService

router = APIRouter(prefix="/fs", tags=["filesystem"])


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


@router.get("/git-status", response_model=GitStatusResponse)
async def get_git_status(
    path: str = Query(..., description="Git 상태를 조회할 경로"),
    fs: FilesystemService = Depends(get_filesystem_service),
):
    try:
        return await fs.get_git_status(path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/git-diff", response_class=PlainTextResponse)
async def get_git_diff(
    path: str = Query(..., description="Git 저장소 경로"),
    file: str = Query(
        ..., description="diff를 조회할 파일 경로 (저장소 루트 기준 상대 경로)"
    ),
    fs: FilesystemService = Depends(get_filesystem_service),
):
    try:
        result = await fs.get_file_diff(path, file)
        return PlainTextResponse(result or "")
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


@router.delete("/worktrees")
async def remove_worktree(
    path: str = Query(..., description="삭제할 워크트리 경로"),
    force: bool = Query(
        default=False, description="미커밋 변경사항이 있어도 강제 삭제"
    ),
    fs: FilesystemService = Depends(get_filesystem_service),
):
    try:
        await fs.remove_worktree(path, force=force)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/git-log", response_model=GitLogResponse)
async def get_git_log(
    path: str = Query(..., description="Git 저장소 경로"),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    author: str | None = Query(default=None),
    since: str | None = Query(default=None),
    until: str | None = Query(default=None),
    search: str | None = Query(default=None),
    fs: FilesystemService = Depends(get_filesystem_service),
):
    try:
        return await fs.get_git_log(
            path,
            limit=limit,
            offset=offset,
            author=author,
            since=since,
            until=until,
            search=search,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/git-commit-diff", response_class=PlainTextResponse)
async def get_commit_diff(
    path: str = Query(..., description="Git 저장소 경로"),
    commit: str = Query(..., min_length=7, max_length=40, description="커밋 해시"),
    fs: FilesystemService = Depends(get_filesystem_service),
):
    try:
        result = await fs.get_commit_diff(path, commit)
        return PlainTextResponse(result or "")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/gh-status", response_model=GitHubCLIStatus)
async def get_gh_status(
    path: str = Query(..., description="Git 저장소 경로"),
    fs: FilesystemService = Depends(get_filesystem_service),
):
    try:
        return await fs.check_gh_status(path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/gh-prs", response_model=GitHubPRListResponse)
async def get_github_prs(
    path: str = Query(..., description="Git 저장소 경로"),
    state: str = Query(default="open"),
    limit: int = Query(default=20, ge=1, le=100),
    fs: FilesystemService = Depends(get_filesystem_service),
):
    try:
        return await fs.get_github_prs(path, state=state, limit=limit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/gh-pr-detail", response_model=GitHubPRDetail)
async def get_github_pr_detail(
    path: str = Query(..., description="Git 저장소 경로"),
    number: int = Query(..., ge=1, description="PR 번호"),
    fs: FilesystemService = Depends(get_filesystem_service),
):
    try:
        return await fs.get_github_pr_detail(path, number)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/gh-pr-diff", response_class=PlainTextResponse)
async def get_github_pr_diff(
    path: str = Query(..., description="Git 저장소 경로"),
    number: int = Query(..., ge=1, description="PR 번호"),
    fs: FilesystemService = Depends(get_filesystem_service),
):
    try:
        result = await fs.get_github_pr_diff(path, number)
        return PlainTextResponse(result or "")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/skills", response_model=SkillListResponse)
async def list_skills(
    path: str = Query(default="", description="프로젝트 작업 디렉토리 경로"),
    fs: FilesystemService = Depends(get_filesystem_service),
):
    return await fs.list_skills(path)
