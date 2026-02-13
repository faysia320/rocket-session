"""파일시스템 탐색 및 Git 작업 서비스."""

import asyncio
import os
from pathlib import Path
from typing import Optional

from app.schemas.filesystem import (
    DirectoryEntry,
    DirectoryListResponse,
    GitInfo,
    WorktreeInfo,
    WorktreeListResponse,
)


class FilesystemService:
    """파일시스템 탐색 및 Git 워크트리 관리 서비스."""

    def _validate_path(self, path: str) -> Path:
        """경로 유효성 검사 및 확장."""
        expanded = os.path.expanduser(path)
        resolved = Path(expanded).resolve()
        if not resolved.exists():
            raise ValueError(f"경로가 존재하지 않습니다: {path}")
        return resolved

    async def list_directory(self, path: str) -> DirectoryListResponse:
        """디렉토리 목록 조회 (하위 디렉토리만, 숨김 제외)."""
        validated_path = self._validate_path(path)

        if not validated_path.is_dir():
            raise ValueError(f"디렉토리가 아닙니다: {path}")

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

        # 상위 디렉토리 계산 (루트면 None)
        parent = None if validated_path.parent == validated_path else str(validated_path.parent)

        return DirectoryListResponse(
            path=str(validated_path),
            parent=parent,
            entries=entries,
        )

    async def _run_git_command(
        self, *args: str, cwd: str, timeout: float = 10.0
    ) -> tuple[int, str, str]:
        """git 명령 실행 후 (returncode, stdout, stderr) 반환."""
        proc = await asyncio.create_subprocess_exec(
            "git",
            *args,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            return proc.returncode or 0, stdout.decode().strip(), stderr.decode().strip()
        except asyncio.TimeoutError:
            proc.kill()
            return -1, "", "timeout"

    async def get_git_info(self, path: str) -> GitInfo:
        """Git 저장소 정보 조회."""
        validated_path = self._validate_path(path)
        cwd = str(validated_path)

        # Git 저장소 여부 확인
        returncode, _, _ = await self._run_git_command(
            "rev-parse", "--is-inside-work-tree", cwd=cwd
        )
        if returncode != 0:
            return GitInfo(is_git_repo=False)

        info = GitInfo(is_git_repo=True)

        # 브랜치명
        returncode, stdout, _ = await self._run_git_command(
            "branch", "--show-current", cwd=cwd
        )
        if returncode == 0 and stdout:
            info.branch = stdout

        # 상태 확인 (dirty / untracked)
        returncode, stdout, _ = await self._run_git_command(
            "status", "--porcelain", cwd=cwd
        )
        if returncode == 0 and stdout:
            lines = stdout.split("\n")
            info.has_untracked = any(line.startswith("?") for line in lines)
            info.is_dirty = any(line and not line.startswith("?") for line in lines)

        # 최근 커밋 정보
        returncode, stdout, _ = await self._run_git_command(
            "log", "-1", "--format=%H%n%s%n%aI", cwd=cwd
        )
        if returncode == 0 and stdout:
            parts = stdout.split("\n", 2)
            if len(parts) >= 1:
                info.last_commit_hash = parts[0]
            if len(parts) >= 2:
                info.last_commit_message = parts[1]
            if len(parts) >= 3:
                info.last_commit_date = parts[2]

        # 리모트 URL (실패해도 무시)
        returncode, stdout, _ = await self._run_git_command(
            "remote", "get-url", "origin", cwd=cwd
        )
        if returncode == 0 and stdout:
            info.remote_url = stdout

        # ahead/behind (실패해도 0/0)
        returncode, stdout, _ = await self._run_git_command(
            "rev-list", "--left-right", "--count", "HEAD...@{upstream}", cwd=cwd
        )
        if returncode == 0 and stdout:
            parts = stdout.split()
            if len(parts) == 2:
                try:
                    info.ahead = int(parts[0])
                    info.behind = int(parts[1])
                except ValueError:
                    pass

        return info

    async def list_worktrees(self, path: str) -> WorktreeListResponse:
        """Git 워크트리 목록 조회."""
        validated_path = self._validate_path(path)
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
