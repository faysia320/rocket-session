"""파일시스템 탐색 API 엔드포인트."""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from app.api.dependencies import (
    get_filesystem_service,
    get_git_service,
    get_github_service,
    get_skills_service,
)
from app.schemas.filesystem import (
    DirectoryListResponse,
    GitBranchListResponse,
    GitCheckoutRequest,
    GitCheckoutResponse,
    GitCommitRequest,
    GitCommitResponse,
    GitFetchRequest,
    GitFetchResponse,
    GitHubCLIStatus,
    GitHubPRDetail,
    GitHubPRListResponse,
    GitInfo,
    GitLogResponse,
    GitRepoScanResponse,
    GitStageRequest,
    GitStageResponse,
    GitStatusResponse,
    PRReviewJobResponse,
    PRReviewRequest,
    PRReviewStatusResponse,
    PRReviewSubmitRequest,
    PRReviewSubmitResponse,
    SkillListResponse,
    WorktreeListResponse,
)
from app.services.filesystem_service import FilesystemService
from app.services.git_service import GitService
from app.services.github_service import GitHubService
from app.services.skills_service import SkillsService

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


@router.get("/scan-git-repos", response_model=GitRepoScanResponse)
async def scan_git_repos(
    path: str = Query(
        default="", description="탐색 시작 경로 (미지정 시 작업 디렉토리 부모)"
    ),
    max_depth: int = Query(default=2, ge=1, le=4, description="최대 탐색 깊이"),
    fs: FilesystemService = Depends(get_filesystem_service),
):
    """지정 경로 아래에서 Git 저장소를 스캔합니다."""
    try:
        return await fs.scan_git_repos(path, max_depth)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/git-info", response_model=GitInfo)
async def get_git_info(
    path: str = Query(..., description="Git 정보를 조회할 경로"),
    git: GitService = Depends(get_git_service),
):
    try:
        return await git.get_git_info(path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/git-status", response_model=GitStatusResponse)
async def get_git_status(
    path: str = Query(..., description="Git 상태를 조회할 경로"),
    git: GitService = Depends(get_git_service),
):
    try:
        return await git.get_git_status(path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/git-diff", response_class=PlainTextResponse)
async def get_git_diff(
    path: str = Query(..., description="Git 저장소 경로"),
    file: str = Query(
        ..., description="diff를 조회할 파일 경로 (저장소 루트 기준 상대 경로)"
    ),
    git: GitService = Depends(get_git_service),
):
    try:
        result = await git.get_file_diff(path, file)
        return PlainTextResponse(result or "")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/worktrees", response_model=WorktreeListResponse)
async def list_worktrees(
    path: str = Query(..., description="Git 저장소 경로"),
    git: GitService = Depends(get_git_service),
):
    try:
        return await git.list_worktrees(path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/worktrees")
async def remove_worktree(
    repo_path: str = Query(..., description="레포 루트 경로"),
    name: str = Query(..., description="워크트리 이름 (claude -w <name>)"),
    force: bool = Query(
        default=False, description="미커밋 변경사항이 있어도 강제 삭제"
    ),
    git: GitService = Depends(get_git_service),
):
    try:
        await git.remove_claude_worktree(repo_path, name, force=force)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except (RuntimeError, OSError) as e:
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
    git: GitService = Depends(get_git_service),
):
    try:
        return await git.get_git_log(
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
    git: GitService = Depends(get_git_service),
):
    try:
        result = await git.get_commit_diff(path, commit)
        return PlainTextResponse(result or "")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/gh-status", response_model=GitHubCLIStatus)
async def get_gh_status(
    path: str = Query(..., description="Git 저장소 경로"),
    gh: GitHubService = Depends(get_github_service),
):
    try:
        return await gh.check_gh_status(path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/gh-prs", response_model=GitHubPRListResponse)
async def get_github_prs(
    path: str = Query(..., description="Git 저장소 경로"),
    state: str = Query(default="open"),
    limit: int = Query(default=20, ge=1, le=100),
    gh: GitHubService = Depends(get_github_service),
):
    try:
        return await gh.get_github_prs(path, state=state, limit=limit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/gh-pr-detail", response_model=GitHubPRDetail)
async def get_github_pr_detail(
    path: str = Query(..., description="Git 저장소 경로"),
    number: int = Query(..., ge=1, description="PR 번호"),
    gh: GitHubService = Depends(get_github_service),
):
    try:
        return await gh.get_github_pr_detail(path, number)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/gh-pr-diff", response_class=PlainTextResponse)
async def get_github_pr_diff(
    path: str = Query(..., description="Git 저장소 경로"),
    number: int = Query(..., ge=1, description="PR 번호"),
    gh: GitHubService = Depends(get_github_service),
):
    try:
        result = await gh.get_github_pr_diff(path, number)
        return PlainTextResponse(result or "")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/gh-pr-review", response_model=PRReviewJobResponse)
async def generate_pr_review(
    req: PRReviewRequest,
    gh: GitHubService = Depends(get_github_service),
):
    """PR 리뷰 비동기 작업 생성."""
    try:
        return await gh.request_pr_review(req.path, req.pr_number)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/gh-pr-review-status/{job_id}", response_model=PRReviewStatusResponse)
async def get_pr_review_status(
    job_id: str,
    gh: GitHubService = Depends(get_github_service),
):
    """PR 리뷰 작업 상태 조회."""
    try:
        return gh.get_pr_review_status(job_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/gh-pr-review-submit", response_model=PRReviewSubmitResponse)
async def submit_pr_review(
    req: PRReviewSubmitRequest,
    gh: GitHubService = Depends(get_github_service),
):
    """PR에 리뷰 코멘트 게시."""
    try:
        return await gh.submit_pr_review_comment(req.path, req.pr_number, req.body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/skills", response_model=SkillListResponse)
async def list_skills(
    path: str = Query(default="", description="프로젝트 작업 디렉토리 경로"),
    skills: SkillsService = Depends(get_skills_service),
):
    return await skills.list_skills(path)


# --- Git Branch / Stage / Commit ---


@router.get("/git-branches", response_model=GitBranchListResponse)
async def list_git_branches(
    path: str = Query(..., description="Git 저장소 경로"),
    git: GitService = Depends(get_git_service),
):
    try:
        branches, current, default_branch = await git.list_branches(path)
        return GitBranchListResponse(
            branches=branches,
            current_branch=current,
            default_branch=default_branch,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/git-checkout", response_model=GitCheckoutResponse)
async def checkout_git_branch(
    req: GitCheckoutRequest,
    git: GitService = Depends(get_git_service),
):
    try:
        success, message = await git.checkout_branch(req.path, req.branch)
        if not success:
            raise HTTPException(status_code=400, detail=message)
        return GitCheckoutResponse(success=True, message=message)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/git-stage", response_model=GitStageResponse)
async def stage_git_files(
    req: GitStageRequest,
    git: GitService = Depends(get_git_service),
):
    try:
        success, error = await git.stage_files(req.path, req.files)
        if not success:
            raise HTTPException(status_code=400, detail=error)
        return GitStageResponse(success=True)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/git-commit", response_model=GitCommitResponse)
async def commit_git(
    req: GitCommitRequest,
    git: GitService = Depends(get_git_service),
):
    try:
        success, commit_hash, error = await git.commit(req.path, req.message)
        if not success:
            raise HTTPException(status_code=400, detail=error)
        return GitCommitResponse(success=True, commit_hash=commit_hash)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/git-fetch", response_model=GitFetchResponse)
async def fetch_git_remote(
    req: GitFetchRequest,
    git: GitService = Depends(get_git_service),
):
    """git fetch --prune 실행."""
    try:
        success, message = await git.fetch_remote(req.path)
        if not success:
            raise HTTPException(status_code=400, detail=message)
        return GitFetchResponse(success=True, message=message)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
