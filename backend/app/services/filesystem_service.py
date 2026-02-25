"""파일시스템 탐색 서비스.

디렉토리 목록 조회 등 파일시스템 탐색 기능만 담당합니다.
Git 관련 기능은 git_service.py, GitHub 관련은 github_service.py,
Skills 관련은 skills_service.py로 분리되었습니다.
"""

import asyncio
import logging
import os
from pathlib import Path

from app.schemas.filesystem import (
    DirectoryEntry,
    DirectoryListResponse,
    GitRepoEntry,
    GitRepoScanResponse,
)

logger = logging.getLogger(__name__)


class FilesystemService:
    """파일시스템 탐색 서비스."""

    def __init__(self, root_dir: str = ""):
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

    async def scan_git_repos(
        self, path: str = "", max_depth: int = 2
    ) -> GitRepoScanResponse:
        """지정 경로 아래에서 Git 저장소를 재귀 탐색합니다.

        Args:
            path: 탐색 시작 경로 (미지정 시 root_dir의 부모 또는 홈 디렉토리)
            max_depth: 최대 탐색 깊이 (기본: 2)
        """
        if path:
            expanded = os.path.expanduser(path)
            base = Path(expanded).resolve()
        elif self._root_dir:
            # root_dir 직접 스캔 (워크스페이스 기반 — 각 저장소가 root_dir 하위에 위치)
            base = self._root_dir
        else:
            base = Path.home()

        if not base.exists() or not base.is_dir():
            raise ValueError(f"경로가 존재하지 않습니다: {path or str(base)}")

        skip_names = frozenset(
            {
                "node_modules",
                "__pycache__",
                ".venv",
                "venv",
                "dist",
                "build",
                "target",
                ".cache",
                ".npm",
                ".pnpm-store",
            }
        )

        def _scan(target: Path, remaining: int) -> list[GitRepoEntry]:
            repos: list[GitRepoEntry] = []
            if remaining <= 0:
                return repos
            try:
                for item in sorted(target.iterdir()):
                    if item.name.startswith("."):
                        continue
                    if not item.is_dir():
                        continue
                    if item.name in skip_names:
                        continue
                    if (item / ".git").exists():
                        repos.append(
                            GitRepoEntry(name=item.name, path=str(item))
                        )
                    elif remaining > 1:
                        repos.extend(_scan(item, remaining - 1))
            except PermissionError:
                pass
            return repos

        repos = await asyncio.to_thread(_scan, base, max_depth)
        return GitRepoScanResponse(repos=repos, scanned_path=str(base))
