"""GitHub CLI 연동 서비스.

gh CLI를 통한 PR 조회, 리뷰 생성, 코멘트 게시 등을 담당합니다.
GitService에 의존하여 경로 유효성 검사와 Git 명령 실행을 위임합니다.
"""

import asyncio
import json
import logging
import subprocess
import time
import uuid
from dataclasses import dataclass, field

from app.schemas.filesystem import (
    GitHubCLIStatus,
    GitHubPRComment,
    GitHubPRDetail,
    GitHubPREntry,
    GitHubPRListResponse,
    GitHubPRReview,
    PRReviewJobResponse,
    PRReviewResponse,
    PRReviewStatusResponse,
    PRReviewSubmitResponse,
)
from app.services.git_service import GitService

logger = logging.getLogger(__name__)


@dataclass
class _ReviewJob:
    """PR 리뷰 백그라운드 작업 상태."""

    status: str = "pending"  # "pending" | "completed" | "error"
    review_text: str = ""
    error: str = ""
    created_at: float = field(default_factory=time.time)


class GitHubService:
    """GitHub CLI (gh) 연동 서비스.

    PR 목록/상세 조회, Claude Code를 이용한 PR 리뷰 생성,
    리뷰 코멘트 게시 등을 담당합니다.
    """

    def __init__(self, git_service: GitService):
        self._git = git_service
        # PR 리뷰 비동기 작업 저장소
        self._review_jobs: dict[str, _ReviewJob] = {}

    async def _run_gh_command(
        self, *args: str, cwd: str, timeout: float = 30.0
    ) -> tuple[int, str, str]:
        """gh CLI 명령 실행 후 (returncode, stdout, stderr) 반환."""

        def _run() -> tuple[int, str, str]:
            try:
                result = subprocess.run(
                    ["gh", *args],
                    cwd=cwd,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                )
                return result.returncode, result.stdout.strip(), result.stderr.strip()
            except subprocess.TimeoutExpired:
                return -1, "", "timeout"
            except FileNotFoundError:
                return -1, "", "gh CLI not found"

        return await asyncio.to_thread(_run)

    async def check_gh_status(self, path: str) -> GitHubCLIStatus:
        """gh CLI 설치/인증 상태 체크."""
        validated_path = self._git._validate_path(path)
        cwd = str(validated_path)

        # gh 버전 확인
        rc_ver, ver_out, ver_err = await self._run_gh_command("--version", cwd=cwd)
        if rc_ver != 0:
            return GitHubCLIStatus(error=ver_err or "gh CLI를 찾을 수 없습니다")

        version = ver_out.split("\n")[0] if ver_out else None

        # 인증 상태 확인
        rc_auth, _, auth_err = await self._run_gh_command(
            "auth", "status", cwd=cwd, timeout=10.0
        )
        if rc_auth != 0:
            return GitHubCLIStatus(
                installed=True,
                version=version,
                error=f"인증 필요: gh auth login 실행 필요 ({auth_err})",
            )

        return GitHubCLIStatus(
            installed=True,
            authenticated=True,
            version=version,
        )

    async def get_github_prs(
        self,
        path: str,
        state: str = "open",
        limit: int = 20,
    ) -> GitHubPRListResponse:
        """GitHub PR 목록 조회."""
        validated_path = self._git._validate_path(path)
        if not self._git._is_within_root(validated_path):
            raise ValueError(f"접근할 수 없는 경로입니다: {path}")
        cwd = str(validated_path)

        rc, out, err = await self._run_gh_command(
            "pr",
            "list",
            f"--state={state}",
            f"--limit={limit}",
            "--json",
            "number,title,state,author,headRefName,baseRefName,createdAt,updatedAt,url,labels,isDraft,additions,deletions",
            cwd=cwd,
            timeout=30.0,
        )

        if rc != 0:
            return GitHubPRListResponse(error=err or "PR 목록 조회 실패")

        try:
            data = json.loads(out) if out else []
        except json.JSONDecodeError:
            return GitHubPRListResponse(error="JSON 파싱 실패")

        prs = []
        for item in data:
            author = item.get("author", {})
            author_login = (
                author.get("login", "") if isinstance(author, dict) else str(author)
            )
            labels = [
                lb.get("name", "") if isinstance(lb, dict) else str(lb)
                for lb in (item.get("labels", []) or [])
            ]
            prs.append(
                GitHubPREntry(
                    number=item.get("number", 0),
                    title=item.get("title", ""),
                    state=item.get("state", ""),
                    author=author_login,
                    branch=item.get("headRefName", ""),
                    base=item.get("baseRefName", ""),
                    created_at=item.get("createdAt", ""),
                    updated_at=item.get("updatedAt", ""),
                    url=item.get("url", ""),
                    labels=labels,
                    draft=item.get("isDraft", False),
                    additions=item.get("additions", 0),
                    deletions=item.get("deletions", 0),
                )
            )

        return GitHubPRListResponse(prs=prs, total_count=len(prs))

    async def get_github_pr_detail(self, path: str, pr_number: int) -> GitHubPRDetail:
        """GitHub PR 상세 조회."""
        validated_path = self._git._validate_path(path)
        if not self._git._is_within_root(validated_path):
            raise ValueError(f"접근할 수 없는 경로입니다: {path}")
        cwd = str(validated_path)

        rc, out, err = await self._run_gh_command(
            "pr",
            "view",
            str(pr_number),
            "--json",
            "number,title,body,state,author,headRefName,baseRefName,createdAt,updatedAt,url,labels,additions,deletions,changedFiles,commits,reviews,comments,mergeable",
            cwd=cwd,
            timeout=30.0,
        )

        if rc != 0:
            return GitHubPRDetail(
                number=pr_number,
                title="",
                body="",
                state="",
                author="",
                branch="",
                base="",
                created_at="",
                updated_at="",
                url="",
                error=err or "PR 상세 조회 실패",
            )

        try:
            data = json.loads(out)
        except json.JSONDecodeError:
            return GitHubPRDetail(
                number=pr_number,
                title="",
                body="",
                state="",
                author="",
                branch="",
                base="",
                created_at="",
                updated_at="",
                url="",
                error="JSON 파싱 실패",
            )

        author = data.get("author", {})
        author_login = (
            author.get("login", "") if isinstance(author, dict) else str(author)
        )
        labels = [
            lb.get("name", "") if isinstance(lb, dict) else str(lb)
            for lb in (data.get("labels", []) or [])
        ]

        # reviews 파싱
        reviews = []
        for r in data.get("reviews", []) or []:
            r_author = r.get("author", {})
            reviews.append(
                GitHubPRReview(
                    author=r_author.get("login", "")
                    if isinstance(r_author, dict)
                    else str(r_author),
                    state=r.get("state", ""),
                    body=r.get("body", ""),
                    submitted_at=r.get("submittedAt", ""),
                )
            )

        # comments 파싱
        comments = []
        for c in data.get("comments", []) or []:
            c_author = c.get("author", {})
            comments.append(
                GitHubPRComment(
                    author=c_author.get("login", "")
                    if isinstance(c_author, dict)
                    else str(c_author),
                    body=c.get("body", ""),
                    created_at=c.get("createdAt", ""),
                    path=c.get("path"),
                    line=c.get("line"),
                )
            )

        commits_data = data.get("commits", []) or []

        return GitHubPRDetail(
            number=data.get("number", pr_number),
            title=data.get("title", ""),
            body=data.get("body", ""),
            state=data.get("state", ""),
            author=author_login,
            branch=data.get("headRefName", ""),
            base=data.get("baseRefName", ""),
            created_at=data.get("createdAt", ""),
            updated_at=data.get("updatedAt", ""),
            url=data.get("url", ""),
            labels=labels,
            additions=data.get("additions", 0),
            deletions=data.get("deletions", 0),
            changed_files=data.get("changedFiles", 0),
            commits_count=len(commits_data) if isinstance(commits_data, list) else 0,
            reviews=reviews,
            comments=comments,
            mergeable=data.get("mergeable"),
        )

    async def get_github_pr_diff(self, path: str, pr_number: int) -> str:
        """GitHub PR diff 조회."""
        validated_path = self._git._validate_path(path)
        if not self._git._is_within_root(validated_path):
            raise ValueError(f"접근할 수 없는 경로입니다: {path}")
        cwd = str(validated_path)

        rc, out, err = await self._run_gh_command(
            "pr", "diff", str(pr_number), cwd=cwd, timeout=30.0
        )
        if rc != 0:
            raise ValueError(f"PR diff 조회 실패: {err}")
        return out

    async def generate_pr_review(self, path: str, pr_number: int) -> PRReviewResponse:
        """Claude Code CLI로 PR 리뷰 생성."""
        validated_path = self._git._validate_path(path)
        if not self._git._is_within_root(validated_path):
            raise ValueError(f"접근할 수 없는 경로입니다: {path}")
        cwd = str(validated_path)

        # 1. PR 상세 정보 가져오기
        pr_detail = await self.get_github_pr_detail(path, pr_number)
        if pr_detail.error:
            return PRReviewResponse(error=f"PR 정보 조회 실패: {pr_detail.error}")

        # 2. PR diff 가져오기
        try:
            diff_text = await self.get_github_pr_diff(path, pr_number)
        except ValueError as e:
            return PRReviewResponse(error=str(e))

        # diff가 너무 길면 잘라냄 (Claude 토큰 제한 고려)
        max_diff_chars = 50000
        if len(diff_text) > max_diff_chars:
            diff_text = (
                diff_text[:max_diff_chars] + "\n\n... (diff가 너무 길어 잘렸습니다)"
            )

        # 3. Claude Code CLI로 리뷰 생성
        prompt = (
            f"다음은 GitHub Pull Request #{pr_number}의 정보와 diff입니다.\n"
            f"이 PR을 코드 리뷰해주세요.\n\n"
            f"## PR 정보\n"
            f"- 제목: {pr_detail.title}\n"
            f"- 작성자: {pr_detail.author}\n"
            f"- 브랜치: {pr_detail.branch} -> {pr_detail.base}\n"
            f"- 변경: +{pr_detail.additions} -{pr_detail.deletions}, "
            f"{pr_detail.changed_files}개 파일\n\n"
            f"## PR 설명\n{pr_detail.body or '(없음)'}\n\n"
            f"## Diff\n```diff\n{diff_text}\n```\n\n"
            f"## 리뷰 요청\n"
            f"위 PR의 코드 변경사항을 리뷰해주세요. 다음 항목을 포함해주세요:\n"
            f"1. **요약**: 변경사항의 전체적인 요약\n"
            f"2. **좋은 점**: 잘 작성된 부분\n"
            f"3. **개선 제안**: 개선이 필요한 부분 (파일명, 라인 번호 포함)\n"
            f"4. **잠재적 이슈**: 버그, 보안, 성능 관련 우려사항\n\n"
            f"마크다운 형식으로 작성해주세요."
        )

        def _run_claude() -> tuple[int, str, str]:
            try:
                result = subprocess.run(
                    ["claude", "-p", prompt, "--output-format", "text"],
                    cwd=cwd,
                    capture_output=True,
                    text=True,
                    timeout=120,
                )
                return result.returncode, result.stdout.strip(), result.stderr.strip()
            except subprocess.TimeoutExpired:
                return -1, "", "Claude Code 실행 시간 초과 (120초)"
            except FileNotFoundError:
                return -1, "", "Claude Code CLI를 찾을 수 없습니다"

        rc, stdout, stderr = await asyncio.to_thread(_run_claude)

        if rc != 0:
            return PRReviewResponse(
                error=stderr or f"Claude Code 실행 실패 (exit code: {rc})"
            )

        return PRReviewResponse(review_text=stdout)

    async def request_pr_review(self, path: str, pr_number: int) -> PRReviewJobResponse:
        """PR 리뷰 비동기 작업 생성 + 백그라운드 실행 시작."""
        self._cleanup_old_review_jobs()
        job_id = str(uuid.uuid4())
        self._review_jobs[job_id] = _ReviewJob()
        task = asyncio.create_task(self._run_pr_review(job_id, path, pr_number))

        def _on_review_done(t: asyncio.Task) -> None:
            if not t.cancelled():
                exc = t.exception()
                if exc:
                    logger.error("PR 리뷰 백그라운드 실패 (job %s): %s", job_id, exc)

        task.add_done_callback(_on_review_done)
        return PRReviewJobResponse(job_id=job_id, status="pending")

    def get_pr_review_status(self, job_id: str) -> PRReviewStatusResponse:
        """PR 리뷰 작업 상태 조회."""
        job = self._review_jobs.get(job_id)
        if not job:
            raise ValueError(f"리뷰 작업을 찾을 수 없습니다: {job_id}")
        return PRReviewStatusResponse(
            job_id=job_id,
            status=job.status,
            review_text=job.review_text,
            error=job.error,
        )

    async def _run_pr_review(self, job_id: str, path: str, pr_number: int) -> None:
        """백그라운드에서 실제 리뷰 생성 (기존 generate_pr_review 활용)."""
        try:
            result = await self.generate_pr_review(path, pr_number)
            job = self._review_jobs.get(job_id)
            if job is None:
                return
            if result.error:
                job.status = "error"
                job.error = result.error
            else:
                job.status = "completed"
                job.review_text = result.review_text
        except Exception as e:
            job = self._review_jobs.get(job_id)
            if job is not None:
                job.status = "error"
                job.error = str(e)

    def _cleanup_old_review_jobs(self) -> None:
        """1시간 이상 된 완료/에러 작업 정리."""
        cutoff = time.time() - 3600
        expired = [jid for jid, j in self._review_jobs.items() if j.created_at < cutoff]
        for jid in expired:
            del self._review_jobs[jid]

    async def submit_pr_review_comment(
        self, path: str, pr_number: int, body: str
    ) -> PRReviewSubmitResponse:
        """PR에 리뷰 코멘트 게시 (gh pr comment)."""
        validated_path = self._git._validate_path(path)
        if not self._git._is_within_root(validated_path):
            raise ValueError(f"접근할 수 없는 경로입니다: {path}")
        cwd = str(validated_path)

        rc, out, err = await self._run_gh_command(
            "pr",
            "comment",
            str(pr_number),
            "--body",
            body,
            cwd=cwd,
            timeout=30.0,
        )

        if rc != 0:
            return PRReviewSubmitResponse(
                success=False,
                error=err or "코멘트 게시 실패",
            )

        return PRReviewSubmitResponse(success=True)
