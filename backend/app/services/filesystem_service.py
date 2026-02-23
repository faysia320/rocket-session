"""파일시스템 탐색 및 Git 작업 서비스."""

import asyncio
from collections import OrderedDict
import json
import logging
import os
import subprocess
import time
from pathlib import Path
from typing import Optional

from app.schemas.filesystem import (
    DirectoryEntry,
    DirectoryListResponse,
    GitCommitEntry,
    GitHubCLIStatus,
    GitHubPRComment,
    GitHubPRDetail,
    GitHubPREntry,
    GitHubPRListResponse,
    GitHubPRReview,
    GitInfo,
    GitLogResponse,
    GitStatusFile,
    GitStatusResponse,
    PRReviewResponse,
    PRReviewSubmitResponse,
    SkillInfo,
    SkillListResponse,
    WorktreeInfo,
    WorktreeListResponse,
)

logger = logging.getLogger(__name__)


class FilesystemService:
    """파일시스템 탐색 및 Git 워크트리 관리 서비스."""

    # Git 정보 캐시 최대 항목 수
    _GIT_CACHE_MAX_SIZE = 100

    # Cross-platform git 설정: Windows↔WSL2 환경에서 false positive 방지
    _GIT_CROSS_PLATFORM_OPTS = (
        "-c",
        "core.fileMode=false",  # Windows/Linux 파일 권한 차이 무시
        "-c",
        "core.autocrlf=input",  # CRLF→LF 정규화 (비교 시 clean filter 적용)
        "-c",
        "core.trustctime=false",  # WSL2 ctime 불일치 무시
        "-c",
        "core.checkStat=minimal",  # stat 비교를 mtime+size로 최소화
    )

    def __init__(self, root_dir: str = ""):
        self._git_cache: OrderedDict[str, tuple[float, GitInfo]] = OrderedDict()
        self._git_cache_ttl: float = 10.0  # 10초 TTL
        # 동일 레포에 대한 동시 git 명령 직렬화 (index.lock 경합 방지)
        self._git_locks: OrderedDict[str, asyncio.Lock] = OrderedDict()
        # 탐색 경계: 이 디렉토리 상위로는 이동 불가
        self._root_dir: Path | None = None
        if root_dir:
            expanded = os.path.expanduser(root_dir)
            resolved = Path(expanded).resolve()
            if resolved.exists() and resolved.is_dir():
                self._root_dir = resolved
            else:
                logger.warning(
                    "root_dir '%s' (resolved: '%s') 가 존재하지 않거나 디렉토리가 아닙니다. "
                    "파일시스템 경계가 설정되지 않아 전체 접근이 허용됩니다.",
                    root_dir,
                    resolved,
                )

    def _get_git_lock(self, path: str) -> asyncio.Lock:
        """경로별 asyncio.Lock 반환 (OrderedDict LRU, 최대 100개, 사용 중 lock 보호)."""
        if path in self._git_locks:
            self._git_locks.move_to_end(path)
            return self._git_locks[path]

        # 새 lock 생성 전 크기 제한 체크
        while len(self._git_locks) >= self._GIT_CACHE_MAX_SIZE:
            oldest_key, oldest_lock = next(iter(self._git_locks.items()))
            if oldest_lock.locked():
                break  # 사용 중인 lock은 제거하지 않음
            del self._git_locks[oldest_key]

        lock = asyncio.Lock()
        self._git_locks[path] = lock
        return lock

    @property
    def root_dir(self) -> str:
        """탐색 루트 디렉토리 경로."""
        return str(self._root_dir) if self._root_dir else ""

    def _validate_path(self, path: str) -> Path:
        """경로 유효성 검사 및 확장."""
        expanded = os.path.expanduser(path)
        resolved = Path(expanded).resolve()
        if not resolved.exists():
            raise ValueError(f"경로가 존재하지 않습니다: {path}")
        return resolved

    def _is_within_root(self, path: Path) -> bool:
        """경로가 root_dir 경계 안에 있는지 확인."""
        if not self._root_dir:
            return True
        try:
            path.relative_to(self._root_dir)
            return True
        except ValueError:
            return False

    async def list_directory(self, path: str) -> DirectoryListResponse:
        """디렉토리 목록 조회 (하위 디렉토리만, 숨김 제외)."""
        validated_path = self._validate_path(path)

        if not validated_path.is_dir():
            raise ValueError(f"디렉토리가 아닙니다: {path}")

        # root_dir 경계 밖이면 root_dir로 리다이렉트
        if not self._is_within_root(validated_path):
            if self._root_dir:
                validated_path = self._root_dir
            else:
                raise ValueError(f"접근할 수 없는 경로입니다: {path}")

        def _scan_directory(target: Path) -> list[DirectoryEntry]:
            """동기 파일시스템 탐색 (이벤트 루프 블로킹 방지용 헬퍼)."""
            items = []
            for item in sorted(target.iterdir()):
                # 숨김 디렉토리 제외
                if item.name.startswith("."):
                    continue

                if item.is_dir():
                    # .git 폴더 존재 여부 확인
                    is_git_repo = (item / ".git").exists()
                    items.append(
                        DirectoryEntry(
                            name=item.name,
                            path=str(item),
                            is_dir=True,
                            is_git_repo=is_git_repo,
                        )
                    )
            return items

        entries = await asyncio.to_thread(_scan_directory, validated_path)

        # 상위 디렉토리 계산 (루트이거나 root_dir 경계이면 None)
        at_root_boundary = validated_path.parent == validated_path or (
            self._root_dir and validated_path == self._root_dir
        )
        parent = None if at_root_boundary else str(validated_path.parent)

        return DirectoryListResponse(
            path=str(validated_path),
            parent=parent,
            entries=entries,
        )

    async def _run_git_command(
        self, *args: str, cwd: str, timeout: float = 10.0
    ) -> tuple[int, str, str]:
        """git 명령 실행 후 (returncode, stdout, stderr) 반환."""

        def _run() -> tuple[int, str, str]:
            try:
                result = subprocess.run(
                    ["git", *args],
                    cwd=cwd,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                )
                return result.returncode, result.stdout.strip(), result.stderr.strip()
            except subprocess.TimeoutExpired:
                return -1, "", "timeout"
            except FileNotFoundError:
                return -1, "", "git not found"

        return await asyncio.to_thread(_run)

    async def get_git_info(self, path: str) -> GitInfo:
        """Git 저장소 정보 조회 (OrderedDict LRU 캐시, 10초 TTL, 최대 100개)."""
        now = time.monotonic()
        cached = self._git_cache.get(path)
        if cached:
            ts, data = cached
            if (now - ts) < self._git_cache_ttl:
                self._git_cache.move_to_end(path)  # LRU 업데이트
                return data
            else:
                del self._git_cache[path]  # 만료된 캐시 제거

        result = await self._fetch_git_info(path)
        # 캐시 크기 제한: O(1) LRU 퇴거
        if len(self._git_cache) >= self._GIT_CACHE_MAX_SIZE:
            self._git_cache.popitem(last=False)  # 가장 오래된 항목 제거
        self._git_cache[path] = (now, result)
        return result

    async def _fetch_git_info(self, path: str) -> GitInfo:
        """Git 저장소 정보 실제 조회."""
        validated_path = self._validate_path(path)
        if not self._is_within_root(validated_path):
            raise ValueError(f"접근할 수 없는 경로입니다: {path}")
        cwd = str(validated_path)

        # Git 저장소 여부 확인
        returncode, _, _ = await self._run_git_command(
            "rev-parse", "--is-inside-work-tree", cwd=cwd
        )
        if returncode != 0:
            return GitInfo(is_git_repo=False)

        info = GitInfo(is_git_repo=True)

        # per-repo lock: get_git_status()와 동시 실행 시 index.lock 경합 방지
        async with self._get_git_lock(cwd):
            # 독립적인 Git 명령을 병렬 실행 (순차 → 병렬로 약 7배 빠름)
            # --no-optional-locks: index.lock 경합 방지
            (
                (rc_branch, branch_out, _),
                (rc_status, status_out, _),
                (rc_log, log_out, _),
                (rc_remote, remote_out, _),
                (rc_ahead, ahead_out, _),
                (rc_dir, git_dir, _),
                (rc_common, git_common, _),
            ) = await asyncio.gather(
                self._run_git_command("branch", "--show-current", cwd=cwd),
                self._run_git_command(
                    *self._GIT_CROSS_PLATFORM_OPTS,
                    "--no-optional-locks",
                    "status",
                    "--porcelain",
                    cwd=cwd,
                    timeout=60.0,
                ),
                self._run_git_command("log", "-1", "--format=%H%n%s%n%aI", cwd=cwd),
                self._run_git_command("remote", "get-url", "origin", cwd=cwd),
                self._run_git_command(
                    "rev-list", "--left-right", "--count", "HEAD...@{upstream}", cwd=cwd
                ),
                self._run_git_command("rev-parse", "--git-dir", cwd=cwd),
                self._run_git_command("rev-parse", "--git-common-dir", cwd=cwd),
            )

        # 브랜치명
        if rc_branch == 0 and branch_out:
            info.branch = branch_out

        # 상태 확인 (dirty / untracked)
        if rc_status == 0 and status_out:
            lines = status_out.split("\n")
            info.has_untracked = any(line.startswith("?") for line in lines)
            info.is_dirty = any(line and not line.startswith("?") for line in lines)

        # 최근 커밋 정보
        if rc_log == 0 and log_out:
            parts = log_out.split("\n", 2)
            if len(parts) >= 1:
                info.last_commit_hash = parts[0]
            if len(parts) >= 2:
                info.last_commit_message = parts[1]
            if len(parts) >= 3:
                info.last_commit_date = parts[2]

        # 리모트 URL (실패해도 무시)
        if rc_remote == 0 and remote_out:
            info.remote_url = remote_out

        # ahead/behind (실패해도 0/0)
        if rc_ahead == 0 and ahead_out:
            parts = ahead_out.split()
            if len(parts) == 2:
                try:
                    info.ahead = int(parts[0])
                    info.behind = int(parts[1])
                except ValueError:
                    pass

        # 워크트리 여부 판별
        if rc_dir == 0 and rc_common == 0 and git_dir and git_common:
            norm_dir = os.path.normpath(os.path.join(cwd, git_dir))
            norm_common = os.path.normpath(os.path.join(cwd, git_common))
            info.is_worktree = norm_dir != norm_common

        return info

    async def list_worktrees(self, path: str) -> WorktreeListResponse:
        """Git 워크트리 목록 조회."""
        validated_path = self._validate_path(path)
        if not self._is_within_root(validated_path):
            raise ValueError(f"접근할 수 없는 경로입니다: {path}")
        cwd = str(validated_path)

        returncode, stdout, stderr = await self._run_git_command(
            "worktree", "list", "--porcelain", cwd=cwd
        )
        if returncode != 0:
            raise ValueError(f"Git 워크트리를 조회할 수 없습니다: {stderr}")

        worktrees = []
        lines = stdout.split("\n")
        current_worktree: dict[str, str] = {}
        is_first = True

        for line in lines:
            if not line.strip():
                if current_worktree:
                    worktrees.append(
                        WorktreeInfo(
                            path=current_worktree.get("worktree", ""),
                            commit_hash=current_worktree.get("HEAD", None),
                            branch=current_worktree.get("branch", None),
                            is_main=is_first,
                        )
                    )
                    is_first = False
                    current_worktree = {}
                continue

            if line.startswith("worktree "):
                current_worktree["worktree"] = line[9:]
            elif line.startswith("HEAD "):
                current_worktree["HEAD"] = line[5:]
            elif line.startswith("branch "):
                # refs/heads/branch-name → branch-name
                branch_ref = line[7:]
                if branch_ref.startswith("refs/heads/"):
                    current_worktree["branch"] = branch_ref[11:]
                else:
                    current_worktree["branch"] = branch_ref

        # 마지막 워크트리 처리
        if current_worktree:
            worktrees.append(
                WorktreeInfo(
                    path=current_worktree.get("worktree", ""),
                    commit_hash=current_worktree.get("HEAD", None),
                    branch=current_worktree.get("branch", None),
                    is_main=is_first,
                )
            )

        return WorktreeListResponse(worktrees=worktrees)

    async def remove_claude_worktree(
        self, repo_path: str, worktree_name: str, force: bool = False
    ) -> None:
        """claude -w로 생성된 워크트리 삭제 + 브랜치 정리.

        repo_path: 레포 루트 경로
        worktree_name: 워크트리 이름 (claude -w <name>)
        force: 미커밋 변경사항이 있어도 강제 삭제
        """
        validated_repo = self._validate_path(repo_path)
        if not self._is_within_root(validated_repo):
            raise ValueError(f"접근할 수 없는 경로입니다: {repo_path}")
        cwd = str(validated_repo)

        worktree_path = os.path.join(cwd, ".claude", "worktrees", worktree_name)
        branch_name = f"worktree-{worktree_name}"

        # 1. git worktree remove
        args = ["worktree", "remove"]
        if force:
            args.append("--force")
        args.append(worktree_path)

        returncode, _, stderr = await self._run_git_command(*args, cwd=cwd)
        if returncode != 0:
            raise RuntimeError(f"워크트리 삭제 실패: {stderr}")

        # 2. 로컬 브랜치 삭제
        delete_flag = "-D" if force else "-d"
        await self._run_git_command("branch", delete_flag, branch_name, cwd=cwd)

        # 3. 원격 브랜치 삭제 (보호 브랜치 제외, 실패 시 경고만)
        protected = {"main", "master", "develop", "dev"}
        if branch_name not in protected:
            rc_ls, ls_out, _ = await self._run_git_command(
                "ls-remote",
                "--heads",
                "origin",
                branch_name,
                cwd=cwd,
                timeout=15.0,
            )
            if rc_ls == 0 and ls_out.strip():
                rc_push, _, push_err = await self._run_git_command(
                    "push",
                    "origin",
                    "--delete",
                    branch_name,
                    cwd=cwd,
                    timeout=30.0,
                )
                if rc_push != 0:
                    logger.warning(
                        "원격 브랜치 삭제 실패 (무시): branch=%s, err=%s",
                        branch_name,
                        push_err,
                    )
                else:
                    logger.info("원격 브랜치 삭제 완료: origin/%s", branch_name)

    async def get_git_status(self, path: str) -> GitStatusResponse:
        """git status --porcelain=v1 결과를 파싱하여 변경 파일 목록 반환."""
        validated_path = self._validate_path(path)
        cwd = str(validated_path)
        start = time.monotonic()

        # git 저장소 여부 확인
        rc, _, _ = await self._run_git_command(
            "rev-parse", "--is-inside-work-tree", cwd=cwd
        )
        if rc != 0:
            return GitStatusResponse(is_git_repo=False)

        # per-repo lock: get_git_info()와 동시 실행 시 subprocess 경합 방지
        async with self._get_git_lock(cwd):
            # update-index --refresh 제거: 대형 레포(WSL2 9P)에서 타임아웃 위험
            # git status가 내부적으로 refresh_index()를 호출하므로 별도 실행 불필요
            # --no-optional-locks: index.lock 경합 방지 (VS Code 등과 안전 공존)
            (
                (rc_root, root_out, _),
                (rc_status, status_out, stderr),
            ) = await asyncio.gather(
                self._run_git_command("rev-parse", "--show-toplevel", cwd=cwd),
                self._run_git_command(
                    *self._GIT_CROSS_PLATFORM_OPTS,
                    "--no-optional-locks",
                    "status",
                    "--porcelain=v1",
                    cwd=cwd,
                    timeout=60.0,
                ),
            )

        repo_root = root_out if rc_root == 0 else None

        # git status 실패/타임아웃 시 에러 반환
        if rc_status != 0:
            error_msg = "timeout" if stderr == "timeout" else f"git error: {stderr}"
            logger.error(
                "git status 실패: path=%s, rc=%d, error=%s", path, rc_status, error_msg
            )
            return GitStatusResponse(
                is_git_repo=True, repo_root=repo_root, error=error_msg
            )

        files: list[GitStatusFile] = []

        if status_out:
            for line in status_out.split("\n"):
                if len(line) < 3:
                    continue
                x = line[0]  # index status
                y = line[1]  # working tree status
                file_path = line[3:]
                # rename: "old -> new" 형식에서 new만 사용
                if " -> " in file_path:
                    file_path = file_path.split(" -> ")[-1]
                files.append(
                    GitStatusFile(
                        path=file_path.strip(),
                        status=f"{x}{y}".strip(),
                        is_staged=(x != " " and x != "?"),
                        is_unstaged=(y != " " and y != "?"),
                        is_untracked=(x == "?" and y == "?"),
                    )
                )

        elapsed = time.monotonic() - start
        if len(files) > 100 or elapsed > 5.0:
            staged = sum(1 for f in files if f.is_staged)
            unstaged = sum(1 for f in files if f.is_unstaged)
            untracked = sum(1 for f in files if f.is_untracked)
            logger.warning(
                "git status 대형 결과: path=%s, total=%d "
                "(staged=%d, unstaged=%d, untracked=%d), elapsed=%.1fs",
                path,
                len(files),
                staged,
                unstaged,
                untracked,
                elapsed,
            )

        return GitStatusResponse(
            is_git_repo=True,
            repo_root=repo_root,
            files=files,
            total_count=len(files),
        )

    async def get_file_diff(self, repo_path: str, file_path: str) -> str:
        """임의 경로 기준 특정 파일의 git diff 반환 (세션 비종속).

        우선순위: HEAD diff → unstaged diff → staged diff → untracked
        """
        validated_path = self._validate_path(repo_path)
        cwd = str(validated_path)

        # 4단계 폴백
        for git_args in [
            ["diff", "HEAD", "--", file_path],
            ["diff", "--", file_path],
            ["diff", "--cached", "--", file_path],
        ]:
            rc, out, _ = await self._run_git_command(*git_args, cwd=cwd)
            if rc == 0 and out.strip():
                return out

        # untracked 파일
        abs_file = (validated_path / file_path).resolve()
        if abs_file.is_file():
            rc, out, _ = await self._run_git_command(
                "diff", "--no-index", "--", "/dev/null", file_path, cwd=cwd
            )
            if out.strip():
                return out

        return ""

    # --- Git Log ---

    async def get_git_log(
        self,
        path: str,
        limit: int = 30,
        offset: int = 0,
        author: str | None = None,
        since: str | None = None,
        until: str | None = None,
        search: str | None = None,
    ) -> GitLogResponse:
        """커밋 히스토리 조회."""
        validated_path = self._validate_path(path)
        if not self._is_within_root(validated_path):
            raise ValueError(f"접근할 수 없는 경로입니다: {path}")
        cwd = str(validated_path)

        # 전체 커밋 수 + 로그를 병렬 실행
        count_args = ["rev-list", "--count", "HEAD"]
        log_args = [
            *self._GIT_CROSS_PLATFORM_OPTS,
            "--no-optional-locks",
            "log",
            f"--format=%H%n%h%n%an%n%ae%n%aI%n%s%n%b%x00",
            f"--max-count={limit + 1}",
            f"--skip={offset}",
        ]
        if author:
            log_args.append(f"--author={author}")
        if since:
            log_args.append(f"--since={since}")
        if until:
            log_args.append(f"--until={until}")
        if search:
            log_args.append(f"--grep={search}")
            log_args.append("-i")

        async with self._get_git_lock(cwd):
            (rc_count, count_out, _), (rc_log, log_out, log_err) = await asyncio.gather(
                self._run_git_command(*count_args, cwd=cwd),
                self._run_git_command(*log_args, cwd=cwd, timeout=30.0),
            )

        total_count = 0
        if rc_count == 0 and count_out:
            try:
                total_count = int(count_out)
            except ValueError:
                pass

        if rc_log != 0:
            error_msg = "timeout" if log_err == "timeout" else f"git error: {log_err}"
            return GitLogResponse(error=error_msg)

        # NUL 구분자로 커밋 분리
        commits: list[GitCommitEntry] = []
        if log_out:
            raw_commits = log_out.split("\x00")
            for raw in raw_commits:
                raw = raw.strip()
                if not raw:
                    continue
                lines = raw.split("\n", 5)
                if len(lines) < 6:
                    continue
                full_hash, short_hash, author_name, author_email, date, rest = (
                    lines[0],
                    lines[1],
                    lines[2],
                    lines[3],
                    lines[4],
                    lines[5],
                )
                # rest = subject\nbody
                subject_lines = rest.split("\n", 1)
                message = subject_lines[0]
                body = subject_lines[1].strip() if len(subject_lines) > 1 else None
                commits.append(
                    GitCommitEntry(
                        hash=short_hash,
                        full_hash=full_hash,
                        message=message,
                        body=body if body else None,
                        author_name=author_name,
                        author_email=author_email,
                        date=date,
                    )
                )

        has_more = len(commits) > limit
        if has_more:
            commits = commits[:limit]

        return GitLogResponse(
            commits=commits,
            total_count=total_count,
            has_more=has_more,
        )

    async def get_commit_diff(self, path: str, commit_hash: str) -> str:
        """특정 커밋의 diff 반환."""
        validated_path = self._validate_path(path)
        if not self._is_within_root(validated_path):
            raise ValueError(f"접근할 수 없는 경로입니다: {path}")
        cwd = str(validated_path)

        rc, out, err = await self._run_git_command(
            "show", "--format=", "--patch", commit_hash, cwd=cwd, timeout=30.0
        )
        if rc != 0:
            raise ValueError(f"커밋 diff 조회 실패: {err}")
        return out

    # --- GitHub CLI ---

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
        validated_path = self._validate_path(path)
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
        validated_path = self._validate_path(path)
        if not self._is_within_root(validated_path):
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
            author_login = author.get("login", "") if isinstance(author, dict) else str(author)
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

    async def get_github_pr_detail(
        self, path: str, pr_number: int
    ) -> GitHubPRDetail:
        """GitHub PR 상세 조회."""
        validated_path = self._validate_path(path)
        if not self._is_within_root(validated_path):
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
        author_login = author.get("login", "") if isinstance(author, dict) else str(author)
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
                    author=r_author.get("login", "") if isinstance(r_author, dict) else str(r_author),
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
                    author=c_author.get("login", "") if isinstance(c_author, dict) else str(c_author),
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
        validated_path = self._validate_path(path)
        if not self._is_within_root(validated_path):
            raise ValueError(f"접근할 수 없는 경로입니다: {path}")
        cwd = str(validated_path)

        rc, out, err = await self._run_gh_command(
            "pr", "diff", str(pr_number), cwd=cwd, timeout=30.0
        )
        if rc != 0:
            raise ValueError(f"PR diff 조회 실패: {err}")
        return out

    async def generate_pr_review(
        self, path: str, pr_number: int
    ) -> PRReviewResponse:
        """Claude Code CLI로 PR 리뷰 생성."""
        validated_path = self._validate_path(path)
        if not self._is_within_root(validated_path):
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
            diff_text = diff_text[:max_diff_chars] + "\n\n... (diff가 너무 길어 잘렸습니다)"

        # 3. Claude Code CLI로 리뷰 생성
        prompt = (
            f"다음은 GitHub Pull Request #{pr_number}의 정보와 diff입니다.\n"
            f"이 PR을 코드 리뷰해주세요.\n\n"
            f"## PR 정보\n"
            f"- 제목: {pr_detail.title}\n"
            f"- 작성자: {pr_detail.author}\n"
            f"- 브랜치: {pr_detail.branch} → {pr_detail.base}\n"
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

    async def submit_pr_review_comment(
        self, path: str, pr_number: int, body: str
    ) -> PRReviewSubmitResponse:
        """PR에 리뷰 코멘트 게시 (gh pr comment)."""
        validated_path = self._validate_path(path)
        if not self._is_within_root(validated_path):
            raise ValueError(f"접근할 수 없는 경로입니다: {path}")
        cwd = str(validated_path)

        rc, out, err = await self._run_gh_command(
            "pr", "comment", str(pr_number), "--body", body,
            cwd=cwd, timeout=30.0,
        )

        if rc != 0:
            return PRReviewSubmitResponse(
                success=False,
                error=err or "코멘트 게시 실패",
            )

        return PRReviewSubmitResponse(success=True)

    async def list_skills(self, path: str) -> SkillListResponse:
        """Skills 목록 조회 (.claude/commands/*.md)."""

        def _scan_skills(project_path: str) -> list[SkillInfo]:
            """동기 스킬 파일 탐색 (이벤트 루프 블로킹 방지용 헬퍼)."""
            results: list[SkillInfo] = []
            seen_names: set[str] = set()

            # 1. 프로젝트 스킬 스캔 ({path}/.claude/commands/)
            if project_path:
                try:
                    project_commands_path = (
                        Path(project_path).resolve() / ".claude" / "commands"
                    )
                    if (
                        project_commands_path.exists()
                        and project_commands_path.is_dir()
                    ):
                        for md_file in sorted(project_commands_path.glob("*.md")):
                            skill_name = md_file.stem
                            description = _extract_first_line(md_file)
                            results.append(
                                SkillInfo(
                                    name=skill_name,
                                    filename=md_file.name,
                                    description=description,
                                    scope="project",
                                )
                            )
                            seen_names.add(skill_name)
                except Exception:
                    pass  # 프로젝트 경로 에러는 무시

            # 2. 사용자 스킬 스캔 (~/.claude/commands/)
            try:
                user_commands_path = Path.home() / ".claude" / "commands"
                if user_commands_path.exists() and user_commands_path.is_dir():
                    for md_file in sorted(user_commands_path.glob("*.md")):
                        skill_name = md_file.stem
                        if skill_name in seen_names:
                            continue  # 프로젝트 스킬이 우선
                        description = _extract_first_line(md_file)
                        results.append(
                            SkillInfo(
                                name=skill_name,
                                filename=md_file.name,
                                description=description,
                                scope="user",
                            )
                        )
            except Exception:
                pass  # 사용자 경로 에러는 무시

            return results

        skills = await asyncio.to_thread(_scan_skills, path)
        return SkillListResponse(skills=skills)


def _extract_first_line(file_path: Path) -> str:
    """파일의 첫 비어있지 않은 줄을 추출."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                stripped = line.strip()
                if stripped:
                    return stripped
    except Exception:
        pass
    return ""
