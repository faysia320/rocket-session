"""파일시스템 탐색 및 Git 작업 서비스."""

import asyncio
import logging
import os
import subprocess
import time
from pathlib import Path
from typing import Optional

from app.schemas.filesystem import (
    DirectoryEntry,
    DirectoryListResponse,
    GitInfo,
    GitStatusFile,
    GitStatusResponse,
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

    def __init__(self, root_dir: str = ""):
        self._git_cache: dict[str, tuple[float, GitInfo]] = {}
        self._git_cache_ttl: float = 10.0  # 10초 TTL
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

        entries = []
        for item in sorted(validated_path.iterdir()):
            # 숨김 디렉토리 제외
            if item.name.startswith("."):
                continue

            if item.is_dir():
                # .git 폴더 존재 여부 확인
                is_git_repo = (item / ".git").exists()
                entries.append(
                    DirectoryEntry(
                        name=item.name,
                        path=str(item),
                        is_dir=True,
                        is_git_repo=is_git_repo,
                    )
                )

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
        """Git 저장소 정보 조회 (10초 TTL 캐시, 최대 100개 항목)."""
        now = time.monotonic()
        cached = self._git_cache.get(path)
        if cached and (now - cached[0]) < self._git_cache_ttl:
            return cached[1]

        result = await self._fetch_git_info(path)
        self._git_cache[path] = (now, result)
        # 캐시 크기 제한: 가장 오래된 항목 제거
        if len(self._git_cache) > self._GIT_CACHE_MAX_SIZE:
            oldest_key = min(self._git_cache, key=lambda k: self._git_cache[k][0])
            del self._git_cache[oldest_key]
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

        # 독립적인 Git 명령을 병렬 실행 (순차 → 병렬로 약 7배 빠름)
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
            self._run_git_command("status", "--porcelain", cwd=cwd),
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

    async def create_worktree(
        self,
        repo_path: str,
        branch: str,
        target_path: Optional[str] = None,
        create_branch: bool = False,
    ) -> WorktreeInfo:
        """Git 워크트리 생성."""
        validated_repo = self._validate_path(repo_path)
        if not self._is_within_root(validated_repo):
            raise ValueError(f"접근할 수 없는 경로입니다: {repo_path}")
        cwd = str(validated_repo)

        # target_path가 없으면 repo_path 옆에 {repo_name}-{branch} 디렉토리 생성
        if not target_path:
            repo_name = validated_repo.name
            target_path = str(validated_repo.parent / f"{repo_name}-{branch}")

        # 워크트리 생성 명령 구성
        args = ["worktree", "add"]
        if create_branch:
            args.extend(["-b", branch])
        args.append(target_path)
        if not create_branch:
            args.append(branch)

        returncode, stdout, stderr = await self._run_git_command(*args, cwd=cwd)
        if returncode != 0:
            raise RuntimeError(f"워크트리 생성 실패: {stderr}")

        # 생성된 워크트리 정보 조회
        returncode, stdout, _ = await self._run_git_command(
            "rev-parse", "HEAD", cwd=target_path
        )
        commit_hash = stdout if returncode == 0 else None

        return WorktreeInfo(
            path=target_path,
            branch=branch,
            commit_hash=commit_hash,
            is_main=False,
        )

    async def remove_worktree(self, worktree_path: str, force: bool = False) -> None:
        """Git 워크트리 삭제 + 연결된 브랜치 정리.

        worktree_path: 삭제할 워크트리의 경로
        force: 미커밋 변경사항이 있어도 강제 삭제
        """
        validated_path = self._validate_path(worktree_path)
        if not self._is_within_root(validated_path):
            raise ValueError(f"접근할 수 없는 경로입니다: {worktree_path}")
        cwd = str(validated_path)

        # 워크트리인지 확인 (git-dir != git-common-dir)
        rc_dir, git_dir, _ = await self._run_git_command(
            "rev-parse", "--git-dir", cwd=cwd
        )
        rc_common, git_common, _ = await self._run_git_command(
            "rev-parse", "--git-common-dir", cwd=cwd
        )
        if rc_dir != 0 or rc_common != 0:
            raise ValueError("유효한 Git 저장소가 아닙니다.")

        norm_dir = os.path.normpath(os.path.join(cwd, git_dir))
        norm_common = os.path.normpath(os.path.join(cwd, git_common))
        if norm_dir == norm_common:
            raise ValueError("메인 저장소는 워크트리 삭제 대상이 아닙니다.")

        # 워크트리의 현재 브랜치명 기억 (삭제 후 브랜치 정리용)
        rc_branch, branch_name, _ = await self._run_git_command(
            "branch", "--show-current", cwd=cwd
        )
        worktree_branch = branch_name if rc_branch == 0 and branch_name else None

        # git-common-dir이 실제 .git 디렉토리 → 메인 레포 경로 추출
        main_repo = os.path.dirname(norm_common)

        # 메인 레포의 현재 브랜치 확인 (같은 브랜치 삭제 방지)
        rc_main, main_branch, _ = await self._run_git_command(
            "branch", "--show-current", cwd=main_repo
        )
        main_current = main_branch if rc_main == 0 and main_branch else None

        # 워크트리 삭제 (메인 레포에서 실행)
        args = ["worktree", "remove"]
        if force:
            args.append("--force")
        args.append(cwd)

        returncode, _, stderr = await self._run_git_command(*args, cwd=main_repo)
        if returncode != 0:
            raise RuntimeError(f"워크트리 삭제 실패: {stderr}")

        # 워크트리에 연결되었던 브랜치 삭제 (메인 브랜치와 다른 경우만)
        if worktree_branch and worktree_branch != main_current:
            delete_flag = "-D" if force else "-d"
            await self._run_git_command(
                "branch", delete_flag, worktree_branch, cwd=main_repo
            )

            # 원격 브랜치 삭제 (보호 브랜치 제외, 실패 시 경고만)
            protected = {"main", "master", "develop", "dev"}
            if worktree_branch not in protected:
                rc_ls, ls_out, _ = await self._run_git_command(
                    "ls-remote",
                    "--heads",
                    "origin",
                    worktree_branch,
                    cwd=main_repo,
                    timeout=15.0,
                )
                if rc_ls == 0 and ls_out.strip():
                    rc_push, _, push_err = await self._run_git_command(
                        "push",
                        "origin",
                        "--delete",
                        worktree_branch,
                        cwd=main_repo,
                        timeout=30.0,
                    )
                    if rc_push != 0:
                        logger.warning(
                            "원격 브랜치 삭제 실패 (무시): branch=%s, err=%s",
                            worktree_branch,
                            push_err,
                        )
                    else:
                        logger.info(
                            "원격 브랜치 삭제 완료: origin/%s", worktree_branch
                        )

    async def get_git_status(self, path: str) -> GitStatusResponse:
        """git status --porcelain=v1 결과를 파싱하여 변경 파일 목록 반환."""
        validated_path = self._validate_path(path)
        cwd = str(validated_path)

        # git 저장소 여부 확인
        rc, _, _ = await self._run_git_command(
            "rev-parse", "--is-inside-work-tree", cwd=cwd
        )
        if rc != 0:
            return GitStatusResponse(is_git_repo=False)

        # repo 루트 + status 병렬 실행
        # -u 플래그 미사용: 기본값(--untracked-files=normal)으로
        # untracked 디렉토리를 단일 항목으로 표시 (재귀 확장 방지)
        (rc_root, root_out, _), (rc_status, status_out, _) = await asyncio.gather(
            self._run_git_command("rev-parse", "--show-toplevel", cwd=cwd),
            self._run_git_command("status", "--porcelain=v1", cwd=cwd),
        )

        repo_root = root_out if rc_root == 0 else None
        files: list[GitStatusFile] = []

        if rc_status == 0 and status_out:
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

    async def list_skills(self, path: str) -> SkillListResponse:
        """Skills 목록 조회 (.claude/commands/*.md)."""
        skills = []
        seen_names = set()  # 프로젝트 skills 우선순위를 위한 중복 체크

        # 1. 프로젝트 스킬 스캔 ({path}/.claude/commands/)
        if path:
            try:
                project_commands_path = Path(path).resolve() / ".claude" / "commands"
                if project_commands_path.exists() and project_commands_path.is_dir():
                    for md_file in sorted(project_commands_path.glob("*.md")):
                        skill_name = md_file.stem
                        description = self._extract_first_line(md_file)
                        skills.append(
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
                    description = self._extract_first_line(md_file)
                    skills.append(
                        SkillInfo(
                            name=skill_name,
                            filename=md_file.name,
                            description=description,
                            scope="user",
                        )
                    )
        except Exception:
            pass  # 사용자 경로 에러는 무시

        return SkillListResponse(skills=skills)

    def _extract_first_line(self, file_path: Path) -> str:
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
