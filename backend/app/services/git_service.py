"""Git 저장소 관리 서비스.

Git 정보 조회, 워크트리 관리, diff, log 등 Git CLI 작업을 담당합니다.
"""

import asyncio
import logging
import os
import time
from collections import OrderedDict
from pathlib import Path

from app.schemas.filesystem import (
    GitCommitEntry,
    GitInfo,
    GitLogResponse,
    GitStatusFile,
    GitStatusResponse,
    WorktreeInfo,
    WorktreeListResponse,
)

logger = logging.getLogger(__name__)


class GitService:
    """Git 저장소 정보 조회 및 워크트리 관리 서비스."""

    # Git 정보 캐시 최대 항목 수
    _GIT_CACHE_MAX_SIZE = 100

    # Cross-platform git 설정: Windows<->WSL2 환경에서 false positive 방지
    _GIT_CROSS_PLATFORM_OPTS = (
        "-c",
        "core.fileMode=false",  # Windows/Linux 파일 권한 차이 무시
        "-c",
        "core.autocrlf=input",  # CRLF->LF 정규화 (비교 시 clean filter 적용)
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

    @property
    def root_dir(self) -> str:
        """탐색 루트 디렉토리 경로."""
        return str(self._root_dir) if self._root_dir else ""

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

    async def _run_git_command(
        self, *args: str, cwd: str, timeout: float = 10.0
    ) -> tuple[int, str, str]:
        """git 명령 실행 후 (returncode, stdout, stderr) 반환."""

        def _run() -> tuple[int, str, str]:
            import subprocess

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
            # 독립적인 Git 명령을 병렬 실행 (순차 -> 병렬로 약 7배 빠름)
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
                # refs/heads/branch-name -> branch-name
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

    async def create_claude_worktree(self, repo_path: str, worktree_name: str) -> str:
        """claude -w 방식의 워크트리를 미리 생성합니다.

        repo_path: 레포 루트 경로
        worktree_name: 워크트리 이름
        Returns: 생성된 워크트리 경로
        """
        validated_repo = self._validate_path(repo_path)
        if not self._is_within_root(validated_repo):
            raise ValueError(f"접근할 수 없는 경로입니다: {repo_path}")
        cwd = str(validated_repo)

        worktree_path = os.path.join(cwd, ".claude", "worktrees", worktree_name)
        branch_name = f"worktree-{worktree_name}"

        # 이미 존재하면 경로만 반환
        if os.path.isdir(worktree_path):
            return worktree_path

        # .claude/worktrees 디렉토리 보장
        os.makedirs(os.path.join(cwd, ".claude", "worktrees"), exist_ok=True)

        # git worktree add -b worktree-<name> <path>
        # Docker on WSL2 환경에서 워크트리 생성이 느릴 수 있으므로 120초 타임아웃
        returncode, _, stderr = await self._run_git_command(
            "worktree",
            "add",
            "-b",
            branch_name,
            worktree_path,
            cwd=cwd,
            timeout=120.0,
        )
        if returncode != 0:
            # 타임아웃이지만 파일시스템 작업은 완료된 경우 (부분 성공)
            if stderr == "timeout" and os.path.isdir(worktree_path):
                return worktree_path
            raise RuntimeError(f"워크트리 생성 실패: {stderr}")

        return worktree_path

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

        # 1. git worktree remove (폴백 전략 포함)
        if os.path.isdir(worktree_path):
            args = ["worktree", "remove"]
            if force:
                args.append("--force")
            args.append(worktree_path)

            returncode, _, stderr = await self._run_git_command(
                *args, cwd=cwd, timeout=60.0
            )
            if returncode != 0:
                # 폴백: 디렉토리 수동 삭제 + git worktree prune
                logger.warning(
                    "git worktree remove 실패, 수동 정리 시도: %s", stderr
                )
                import shutil

                shutil.rmtree(worktree_path, ignore_errors=True)
                await self._run_git_command("worktree", "prune", cwd=cwd)
        else:
            # 워크트리 디렉토리가 이미 없음 → prune만 실행
            logger.info("워크트리 디렉토리 없음, prune 실행: %s", worktree_path)
            await self._run_git_command("worktree", "prune", cwd=cwd)

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

        우선순위: HEAD diff -> unstaged diff -> staged diff -> untracked
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
            "--format=%H%n%h%n%an%n%ae%n%aI%n%s%n%b%x00",
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

    # ─── 커밋 관련 ───

    async def stage_files(
        self, repo_path: str, files: list[str] | None = None
    ) -> tuple[bool, str]:
        """파일 스테이징. files=None이면 git add -A (전체).

        Returns:
            (success, error_message)
        """
        validated = self._validate_path(repo_path)
        if not self._is_within_root(validated):
            raise ValueError(f"접근할 수 없는 경로입니다: {repo_path}")
        cwd = str(validated)

        async with self._get_git_lock(cwd):
            if files:
                args = [*self._GIT_CROSS_PLATFORM_OPTS, "add", "--"] + files
            else:
                args = [*self._GIT_CROSS_PLATFORM_OPTS, "add", "-A"]

            rc, _, stderr = await self._run_git_command(*args, cwd=cwd, timeout=30.0)
            if rc != 0:
                return False, f"git add 실패: {stderr}"
            return True, ""

    async def commit(
        self, repo_path: str, message: str
    ) -> tuple[bool, str, str]:
        """커밋 실행.

        Returns:
            (success, commit_hash, error_message)
        """
        validated = self._validate_path(repo_path)
        if not self._is_within_root(validated):
            raise ValueError(f"접근할 수 없는 경로입니다: {repo_path}")
        cwd = str(validated)

        async with self._get_git_lock(cwd):
            rc, _, stderr = await self._run_git_command(
                *self._GIT_CROSS_PLATFORM_OPTS,
                "commit",
                "-m",
                message,
                cwd=cwd,
                timeout=30.0,
            )
            if rc != 0:
                return False, "", f"git commit 실패: {stderr}"

            # 커밋 해시 조회
            rc_hash, hash_out, _ = await self._run_git_command(
                "rev-parse", "--short", "HEAD", cwd=cwd
            )
            commit_hash = hash_out if rc_hash == 0 else ""

            # 캐시 무효화
            if repo_path in self._git_cache:
                del self._git_cache[repo_path]

            return True, commit_hash, ""
