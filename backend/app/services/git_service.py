"""Git 저장소 관리 서비스.

Git 정보 조회, 워크트리 관리, diff, log 등 Git CLI 작업을 담당합니다.
"""

import asyncio
import logging
import os
import time
from collections import OrderedDict
from pathlib import Path

from app.core.exceptions import ValidationError
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
    """Git 저장소 정보 조회 및 워크트리 관리 서비스.

    에러 반환 규약:
        - 읽기 작업 (get_git_info, get_git_status 등): 예외 발생 (ValidationError)
        - 쓰기 작업 (commit, pull, push 등): tuple (success, ...) 반환
    """

    # Git 정보 캐시 최대 항목 수
    _GIT_CACHE_MAX_SIZE = 100

    # Git 명령 타임아웃 (초)
    _DEFAULT_GIT_TIMEOUT = 10.0
    _WRITE_GIT_TIMEOUT = 30.0
    _HEAVY_GIT_TIMEOUT = 60.0
    _NETWORK_GIT_TIMEOUT = 120.0
    _LS_REMOTE_TIMEOUT = 15.0

    # 문자열 접두사 상수
    _WORKTREE_PREFIX = "worktree "
    _REFS_HEADS_PREFIX = "refs/heads/"

    # 보호 브랜치 (원격 삭제 금지)
    _PROTECTED_BRANCHES = frozenset({"main", "master", "develop", "dev"})

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
        # cache stampede 방지: 동일 경로 동시 캐시 미스 시 1회만 fetch
        self._inflight_fetches: dict[str, asyncio.Event] = {}
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
        evicted = False
        while len(self._git_locks) >= self._GIT_CACHE_MAX_SIZE:
            oldest_key, oldest_lock = next(iter(self._git_locks.items()))
            if oldest_lock.locked():
                if not evicted:
                    logger.warning(
                        "Git lock pool 포화: %d개 중 가장 오래된 lock이 사용 중 "
                        "(path=%s). 무한 성장 주의.",
                        len(self._git_locks),
                        oldest_key,
                    )
                break
            del self._git_locks[oldest_key]
            evicted = True

        lock = asyncio.Lock()
        self._git_locks[path] = lock
        return lock

    def _validate_path(self, path: str) -> Path:
        """경로 유효성 검사 및 확장."""
        expanded = os.path.expanduser(path)
        resolved = Path(expanded).resolve()
        if not resolved.exists():
            raise ValidationError(f"경로가 존재하지 않습니다: {path}")
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

    def _resolve_cwd(self, path: str) -> str:
        """경로 유효성 검사 + 경계 검증 + cwd 문자열 반환.

        _validate_path()와 _is_within_root()를 결합하여 반복되는
        3-4행 패턴을 1행 호출로 통합합니다.
        """
        validated = self._validate_path(path)
        if not self._is_within_root(validated):
            raise ValidationError(f"접근할 수 없는 경로입니다: {path}")
        return str(validated)

    def _invalidate_cache(self, path: str) -> None:
        """지정 경로의 Git 정보 캐시를 무효화."""
        if path in self._git_cache:
            del self._git_cache[path]

    # ── 파싱 유틸리티 (static) ──

    @staticmethod
    def _parse_porcelain_status(output: str) -> tuple[bool, bool]:
        """porcelain status 출력을 파싱하여 (is_dirty, has_untracked) 반환."""
        is_dirty = False
        has_untracked = False
        for line in output.split("\n"):
            if not line:
                continue
            if line.startswith("?"):
                has_untracked = True
            else:
                is_dirty = True
        return is_dirty, has_untracked

    @staticmethod
    def _parse_commit_log(output: str) -> tuple[str | None, str | None, str | None]:
        """git log -1 --format=%H%n%s%n%aI 출력에서 (hash, message, date) 추출."""
        parts = output.split("\n", 2)
        commit_hash = parts[0] if len(parts) >= 1 else None
        message = parts[1] if len(parts) >= 2 else None
        date = parts[2] if len(parts) >= 3 else None
        return commit_hash, message, date

    @staticmethod
    def _parse_ahead_behind(output: str) -> tuple[int, int]:
        """rev-list --left-right --count 출력에서 (ahead, behind) 추출."""
        parts = output.split()
        if len(parts) == 2:
            try:
                return int(parts[0]), int(parts[1])
            except ValueError:
                pass
        return 0, 0

    @staticmethod
    def _parse_log_entries(
        output: str, limit: int
    ) -> tuple[list[GitCommitEntry], bool]:
        """NUL 구분자 포맷 로그 출력을 파싱하여 (commits, has_more) 반환."""
        commits: list[GitCommitEntry] = []
        if not output:
            return commits, False

        raw_commits = output.split("\x00")
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
        return commits, has_more

    @staticmethod
    def _parse_worktree_porcelain(output: str) -> list[WorktreeInfo]:
        """git worktree list --porcelain 출력을 파싱하여 WorktreeInfo 목록 반환."""
        worktrees: list[WorktreeInfo] = []
        lines = output.split("\n")
        current: dict[str, str] = {}
        is_first = True

        for line in lines:
            if not line.strip():
                if current:
                    worktrees.append(
                        WorktreeInfo(
                            path=current.get("worktree", ""),
                            commit_hash=current.get("HEAD", None),
                            branch=current.get("branch", None),
                            is_main=is_first,
                        )
                    )
                    is_first = False
                    current = {}
                continue

            if line.startswith("worktree "):
                current["worktree"] = line[len("worktree "):]
            elif line.startswith("HEAD "):
                current["HEAD"] = line[5:]
            elif line.startswith("branch "):
                branch_ref = line[7:]
                if branch_ref.startswith("refs/heads/"):
                    current["branch"] = branch_ref[len("refs/heads/"):]
                else:
                    current["branch"] = branch_ref

        # 마지막 워크트리 처리
        if current:
            worktrees.append(
                WorktreeInfo(
                    path=current.get("worktree", ""),
                    commit_hash=current.get("HEAD", None),
                    branch=current.get("branch", None),
                    is_main=is_first,
                )
            )
        return worktrees

    # ── Git 명령 실행 ──

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
        """Git 저장소 정보 조회 (OrderedDict LRU 캐시, 10초 TTL, 최대 100개).

        cache stampede 방지: 동일 경로 동시 요청 시 첫 번째만 fetch, 나머지는 대기.
        """
        now = time.monotonic()
        cached = self._git_cache.get(path)
        if cached:
            ts, data = cached
            if (now - ts) < self._git_cache_ttl:
                self._git_cache.move_to_end(path)  # LRU 업데이트
                return data
            else:
                del self._git_cache[path]  # 만료된 캐시 제거

        # double-check: 이미 다른 코루틴이 fetch 중이면 대기
        inflight = self._inflight_fetches.get(path)
        if inflight is not None:
            await inflight.wait()
            cached = self._git_cache.get(path)
            if cached:
                return cached[1]

        # 이 코루틴이 fetch를 수행
        event = asyncio.Event()
        self._inflight_fetches[path] = event
        try:
            result = await self._fetch_git_info(path)
            # 캐시 크기 제한: O(1) LRU 퇴거
            if len(self._git_cache) >= self._GIT_CACHE_MAX_SIZE:
                self._git_cache.popitem(last=False)  # 가장 오래된 항목 제거
            self._git_cache[path] = (time.monotonic(), result)
            return result
        finally:
            self._inflight_fetches.pop(path, None)
            event.set()

    async def _fetch_git_info(self, path: str) -> GitInfo:
        """Git 저장소 정보 실제 조회."""
        cwd = self._resolve_cwd(path)

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
            info.is_dirty, info.has_untracked = self._parse_porcelain_status(status_out)

        # 최근 커밋 정보
        if rc_log == 0 and log_out:
            info.last_commit_hash, info.last_commit_message, info.last_commit_date = (
                self._parse_commit_log(log_out)
            )

        # 리모트 URL (실패해도 무시)
        if rc_remote == 0 and remote_out:
            info.remote_url = remote_out

        # ahead/behind (실패해도 0/0)
        if rc_ahead == 0 and ahead_out:
            info.ahead, info.behind = self._parse_ahead_behind(ahead_out)

        # 워크트리 여부 판별
        if rc_dir == 0 and rc_common == 0 and git_dir and git_common:
            norm_dir = os.path.normpath(os.path.join(cwd, git_dir))
            norm_common = os.path.normpath(os.path.join(cwd, git_common))
            info.is_worktree = norm_dir != norm_common

        return info

    async def list_worktrees(self, path: str) -> WorktreeListResponse:
        """Git 워크트리 목록 조회."""
        cwd = self._resolve_cwd(path)

        returncode, stdout, stderr = await self._run_git_command(
            "worktree", "list", "--porcelain", cwd=cwd
        )
        if returncode != 0:
            raise ValidationError(f"Git 워크트리를 조회할 수 없습니다: {stderr}")

        worktrees = self._parse_worktree_porcelain(stdout)
        return WorktreeListResponse(worktrees=worktrees)

    async def create_claude_worktree(self, repo_path: str, worktree_name: str) -> str:
        """claude -w 방식의 워크트리를 미리 생성합니다.

        repo_path: 레포 루트 경로
        worktree_name: 워크트리 이름
        Returns: 생성된 워크트리 경로
        """
        cwd = self._resolve_cwd(repo_path)

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
        cwd = self._resolve_cwd(repo_path)

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
                logger.warning("git worktree remove 실패, 수동 정리 시도: %s", stderr)
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
        if branch_name not in self._PROTECTED_BRANCHES:
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
        cwd = self._resolve_cwd(path)
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
        cwd = self._resolve_cwd(repo_path)

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
        abs_file = (Path(cwd) / file_path).resolve()
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
        cwd = self._resolve_cwd(path)

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

        commits, has_more = self._parse_log_entries(log_out, limit)

        return GitLogResponse(
            commits=commits,
            total_count=total_count,
            has_more=has_more,
        )

    async def get_commit_diff(self, path: str, commit_hash: str) -> str:
        """특정 커밋의 diff 반환."""
        cwd = self._resolve_cwd(path)

        rc, out, err = await self._run_git_command(
            "show", "--format=", "--patch", commit_hash, cwd=cwd, timeout=30.0
        )
        if rc != 0:
            raise ValidationError(f"커밋 diff 조회 실패: {err}")
        return out

    # ─── 브랜치 관련 ───

    async def list_branches(
        self, repo_path: str, *, fetch: bool = True
    ) -> tuple[list[str], str | None, str | None]:
        """로컬 + 원격 브랜치 목록과 현재/기본 브랜치 반환.

        브랜치는 최근 커밋 날짜 순으로 정렬됩니다.

        Args:
            repo_path: Git 저장소 경로
            fetch: True이면 목록 조회 전 git fetch --prune 실행

        Returns:
            (branches, current_branch, default_branch)
        """
        cwd = self._resolve_cwd(repo_path)

        # 원격 ref 갱신 (새 브랜치 감지)
        if fetch:
            await self._run_git_command(
                "fetch", "--prune", "--quiet", cwd=cwd, timeout=30.0
            )

        # 로컬 브랜치 (최근 커밋 순), 원격 브랜치, 현재 브랜치, 기본 브랜치 병렬 조회
        (
            (rc_local, local_out, _),
            (rc_remote, remote_out, _),
            (rc_cur, cur_out, _),
            (rc_default, default_out, _),
        ) = await asyncio.gather(
            self._run_git_command(
                "branch",
                "--list",
                "--sort=-committerdate",
                "--format=%(refname:short)",
                cwd=cwd,
            ),
            self._run_git_command(
                "branch",
                "-r",
                "--sort=-committerdate",
                "--format=%(refname:short)",
                cwd=cwd,
            ),
            self._run_git_command("branch", "--show-current", cwd=cwd),
            self._run_git_command(
                "symbolic-ref",
                "refs/remotes/origin/HEAD",
                "--short",
                cwd=cwd,
            ),
        )

        local_branches: list[str] = []
        if rc_local == 0 and local_out:
            local_branches = [b.strip() for b in local_out.split("\n") if b.strip()]

        # 원격 전용 브랜치 (로컬에 없는 것만, 순서 유지)
        local_set = set(local_branches)
        remote_only: list[str] = []
        if rc_remote == 0 and remote_out:
            for raw in remote_out.split("\n"):
                name = raw.strip()
                if not name or "/HEAD" in name:
                    continue
                # origin/feature-x → feature-x (리모트 접두사 제거)
                short = name.split("/", 1)[1] if "/" in name else name
                if short and short not in local_set:
                    remote_only.append(short)
                    local_set.add(short)  # 중복 방지

        # 최종 목록 (origin/ 접두사 방어적 필터)
        branches = [
            b
            for b in (local_branches + remote_only)
            if not b.startswith("origin/") and b not in ("origin", "HEAD")
        ]
        current = cur_out.strip() if rc_cur == 0 and cur_out else None

        # 기본 브랜치: origin/main → main
        default_branch: str | None = None
        if rc_default == 0 and default_out:
            ref = default_out.strip()
            default_branch = ref.split("/", 1)[1] if "/" in ref else ref

        return branches, current, default_branch

    async def checkout_branch(self, repo_path: str, branch: str) -> tuple[bool, str]:
        """브랜치 체크아웃.

        Returns:
            (success, message)
        """
        cwd = self._resolve_cwd(repo_path)

        async with self._get_git_lock(cwd):
            rc, stdout, stderr = await self._run_git_command(
                *self._GIT_CROSS_PLATFORM_OPTS,
                "checkout",
                branch,
                cwd=cwd,
                timeout=30.0,
            )

        if rc != 0:
            return False, f"git checkout 실패: {stderr}"

        self._invalidate_cache(repo_path)
        return True, stdout or f"Switched to branch '{branch}'"

    # ─── 커밋 관련 ───

    async def stage_files(
        self, repo_path: str, files: list[str] | None = None
    ) -> tuple[bool, str]:
        """파일 스테이징. files=None이면 git add -A (전체).

        Returns:
            (success, error_message)
        """
        cwd = self._resolve_cwd(repo_path)

        async with self._get_git_lock(cwd):
            if files:
                args = [*self._GIT_CROSS_PLATFORM_OPTS, "add", "--"] + files
            else:
                args = [*self._GIT_CROSS_PLATFORM_OPTS, "add", "-A"]

            rc, _, stderr = await self._run_git_command(*args, cwd=cwd, timeout=30.0)
            if rc != 0:
                return False, f"git add 실패: {stderr}"
            return True, ""

    async def unstage_files(
        self, repo_path: str, files: list[str] | None = None
    ) -> tuple[bool, str]:
        """파일 언스테이징. files=None이면 git reset HEAD (전체).

        Returns:
            (success, error_message)
        """
        cwd = self._resolve_cwd(repo_path)

        async with self._get_git_lock(cwd):
            if files:
                args = [
                    *self._GIT_CROSS_PLATFORM_OPTS,
                    "restore",
                    "--staged",
                    "--",
                ] + files
            else:
                args = [*self._GIT_CROSS_PLATFORM_OPTS, "reset", "HEAD"]

            rc, _, stderr = await self._run_git_command(*args, cwd=cwd, timeout=30.0)
            if rc != 0:
                return False, f"git unstage 실패: {stderr}"
            return True, ""

    async def commit(self, repo_path: str, message: str) -> tuple[bool, str, str]:
        """커밋 실행.

        Returns:
            (success, commit_hash, error_message)
        """
        cwd = self._resolve_cwd(repo_path)

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

            self._invalidate_cache(repo_path)
            return True, commit_hash, ""

    # ─── Pull / Push ───

    async def pull(self, repo_path: str, rebase: bool = True) -> tuple[bool, str]:
        """git pull 실행.

        Returns:
            (success, message)
        """
        cwd = self._resolve_cwd(repo_path)

        args = [*self._GIT_CROSS_PLATFORM_OPTS, "pull"]
        if rebase:
            args.append("--rebase")

        async with self._get_git_lock(cwd):
            rc, stdout, stderr = await self._run_git_command(
                *args, cwd=cwd, timeout=120.0
            )

        if rc != 0:
            error = stderr if stderr != "timeout" else "pull 타임아웃"
            return False, f"git pull 실패: {error}"

        self._invalidate_cache(repo_path)
        return True, stdout or "Already up to date."

    async def smart_pull(self, repo_path: str) -> tuple[bool, str, str]:
        """Smart pull: rebase 시도 → 실패 시 abort → 결과 분류.

        Returns:
            (success, message, result_code)
            result_code: "ok" | "auto_reset" | "needs_force_pull"
        """
        cwd = self._resolve_cwd(repo_path)

        async with self._get_git_lock(cwd):
            # Phase 1: git pull --rebase 시도
            rc, stdout, stderr = await self._run_git_command(
                *self._GIT_CROSS_PLATFORM_OPTS,
                "pull",
                "--rebase",
                cwd=cwd,
                timeout=120.0,
            )

            if rc == 0:
                self._invalidate_cache(repo_path)
                return True, stdout or "Already up to date.", "ok"

            # Phase 2: rebase 실패 → abort
            await self._run_git_command("rebase", "--abort", cwd=cwd, timeout=10.0)

            # Phase 3: ahead 확인으로 분류
            rc_ahead, ahead_out, _ = await self._run_git_command(
                "rev-list",
                "--left-right",
                "--count",
                "HEAD...@{upstream}",
                cwd=cwd,
            )
            ahead = 0
            if rc_ahead == 0 and ahead_out:
                ahead, _ = self._parse_ahead_behind(ahead_out)

            error_msg = stderr if stderr != "timeout" else "pull --rebase 타임아웃"

            if ahead == 0:
                return False, error_msg, "auto_reset"
            return False, error_msg, "needs_force_pull"

    async def reset_to_remote(self, repo_path: str) -> tuple[bool, str]:
        """원격 브랜치로 강제 리셋 (git fetch + git reset --hard origin/<branch>).

        Returns:
            (success, message)
        """
        cwd = self._resolve_cwd(repo_path)

        async with self._get_git_lock(cwd):
            # 현재 브랜치명 확인
            rc_branch, branch, _ = await self._run_git_command(
                "branch",
                "--show-current",
                cwd=cwd,
            )
            if rc_branch != 0 or not branch:
                return False, "현재 브랜치를 확인할 수 없습니다"

            # fetch → reset
            rc_fetch, _, stderr_fetch = await self._run_git_command(
                "fetch",
                "origin",
                cwd=cwd,
                timeout=60.0,
            )
            if rc_fetch != 0:
                error = stderr_fetch if stderr_fetch != "timeout" else "fetch 타임아웃"
                return False, f"git fetch 실패: {error}"

            rc_reset, _, stderr_reset = await self._run_git_command(
                "reset",
                "--hard",
                f"origin/{branch}",
                cwd=cwd,
                timeout=30.0,
            )
            if rc_reset != 0:
                return False, f"git reset 실패: {stderr_reset}"

        self._invalidate_cache(repo_path)
        return True, f"origin/{branch} 으로 리셋 완료"

    async def push(
        self,
        repo_path: str,
        remote: str = "origin",
        branch: str | None = None,
    ) -> tuple[bool, str, str | None]:
        """git push 실행.

        Returns:
            (success, message, commit_hash)
        """
        cwd = self._resolve_cwd(repo_path)

        args = [*self._GIT_CROSS_PLATFORM_OPTS, "push", remote]
        if branch:
            args.append(branch)

        async with self._get_git_lock(cwd):
            rc, stdout, stderr = await self._run_git_command(
                *args, cwd=cwd, timeout=120.0
            )

        if rc != 0:
            error = stderr if stderr != "timeout" else "push 타임아웃"
            return False, f"git push 실패: {error}", None

        # 현재 HEAD 해시
        rc_hash, hash_out, _ = await self._run_git_command(
            "rev-parse", "--short", "HEAD", cwd=cwd
        )
        commit_hash = hash_out if rc_hash == 0 else None

        self._invalidate_cache(repo_path)
        return True, stdout or stderr or "push 완료", commit_hash

    async def fetch_remote(
        self, repo_path: str, prune: bool = True
    ) -> tuple[bool, str]:
        """git fetch 실행.

        Returns:
            (success, message)
        """
        cwd = self._resolve_cwd(repo_path)

        args = ["fetch"]
        if prune:
            args.append("--prune")

        rc, stdout, stderr = await self._run_git_command(*args, cwd=cwd, timeout=60.0)

        if rc != 0:
            error = stderr if stderr != "timeout" else "fetch 타임아웃"
            return False, f"git fetch 실패: {error}"

        self._invalidate_cache(repo_path)
        return True, stdout or "fetch 완료"
