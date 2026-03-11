"""Claude Code Memory 파일 읽기 서비스.

Claude Code가 자동으로 생성/관리하는 Memory 파일들을 읽어서
워크스페이스 Knowledge Base에 통합한다.

Memory 파일 위치:
- Auto Memory: ~/.claude/projects/<encoded-path>/memory/*.md
- CLAUDE.md: <project_root>/claude.md 또는 <project_root>/.claude/CLAUDE.md
- Rules: <project_root>/.claude/rules/*.md
- Serena Memory: <project_root>/.serena/memories/*.md
"""

import asyncio
import logging
import time
from pathlib import Path
from typing import Any

from app.schemas.claude_memory import (
    MemoryContextResponse,
    MemoryFileContent,
    MemoryFileInfo,
)

logger = logging.getLogger(__name__)

# ── 소스 상수 (T6: 중복 제거) ────────────────────────────
SOURCE_AUTO_MEMORY = "auto_memory"
SOURCE_CLAUDE_MD = "claude_md"
SOURCE_RULES = "rules"
SOURCE_SERENA_MEMORY = "serena_memory"

# relative_path prefix → MemorySource 매핑 (단일 정의)
PREFIX_TO_SOURCE: dict[str, str] = {
    "auto-memory": SOURCE_AUTO_MEMORY,
    "project": SOURCE_CLAUDE_MD,
    "rules": SOURCE_RULES,
    "serena-memory": SOURCE_SERENA_MEMORY,
}


class ClaudeMemoryService:
    """Claude Code Memory 파일시스템 읽기 서비스."""

    CLAUDE_HOME = Path.home() / ".claude"

    # Memory context limits
    DEFAULT_FILE_LIMIT = 10  # 컨텍스트에 포함할 최대 파일 수
    MAX_CHARS_PER_FILE = 2000  # 각 파일 내용 최대 글자수
    MAX_TOTAL_CHARS = 8000  # 전체 컨텍스트 최대 글자수

    # Source priority (낮을수록 높은 우선순위)
    SOURCE_PRIORITY: dict[str, int] = {
        SOURCE_AUTO_MEMORY: 0,
        SOURCE_CLAUDE_MD: 1,
        SOURCE_RULES: 2,
        SOURCE_SERENA_MEMORY: 3,
    }

    # In-memory cache (TTL-based)
    CACHE_TTL_SECONDS = 300  # 5분: 메모리 파일은 자주 변경되지 않으므로 FS I/O 감소

    def __init__(self) -> None:
        self._cache: dict[str, tuple[float, Any]] = {}

    def _get_cached(self, key: str) -> Any | None:
        cached = self._cache.get(key)
        if cached and time.time() - cached[0] < self.CACHE_TTL_SECONDS:
            return cached[1]
        return None

    def _set_cached(self, key: str, value: Any) -> None:
        self._cache[key] = (time.time(), value)

    def invalidate_cache(self, local_path: str | None = None) -> None:
        """캐시 무효화. local_path 지정 시 해당 워크스페이스만, 없으면 전체."""
        if local_path:
            before = len(self._cache)
            self._cache = {
                k: v
                for k, v in self._cache.items()
                if not k.endswith(f":{local_path}")
            }
            logger.info(
                "KB 캐시 무효화 (local_path=%s): %d → %d 항목",
                local_path,
                before,
                len(self._cache),
            )
        else:
            self._cache.clear()
            logger.info("KB 캐시 전체 무효화")

    @staticmethod
    def encode_project_path(local_path: str) -> str:
        """로컬 경로를 Claude Code 프로젝트 디렉토리명으로 인코딩.

        Examples:
            /workspaces/rocket-session → -workspaces-rocket-session
            C:\\WorkSpace\\repos\\app  → C--WorkSpace-repos-app
        """
        path = local_path.replace("\\", "/")
        # Windows 드라이브 문자 처리: C:/ → C--
        path = path.replace(":/", "--")
        # 나머지 / → -
        path = path.replace("/", "-")
        return path

    # ── 동기 구현체 (asyncio.to_thread에서 실행) ──────────────

    def _list_memory_files_sync(self, local_path: str) -> list[MemoryFileInfo]:
        """파일시스템에서 Memory 파일 목록 수집 (블로킹 I/O)."""
        files: list[MemoryFileInfo] = []
        project_root = Path(local_path)
        encoded = self.encode_project_path(local_path)
        memory_dir = self.CLAUDE_HOME / "projects" / encoded / "memory"

        # 1. Auto Memory: ~/.claude/projects/<encoded>/memory/*.md
        if memory_dir.is_dir():
            for md_file in sorted(memory_dir.glob("*.md")):
                if md_file.is_file():
                    files.append(
                        MemoryFileInfo(
                            name=md_file.name,
                            relative_path=f"auto-memory/{md_file.name}",
                            source=SOURCE_AUTO_MEMORY,
                            size_bytes=md_file.stat().st_size,
                        )
                    )

        # 2. Project CLAUDE.md
        for candidate in [
            project_root / "claude.md",
            project_root / "CLAUDE.md",
            project_root / ".claude" / "CLAUDE.md",
        ]:
            if candidate.is_file():
                files.append(
                    MemoryFileInfo(
                        name=candidate.name,
                        relative_path=f"project/{candidate.name}",
                        source=SOURCE_CLAUDE_MD,
                        size_bytes=candidate.stat().st_size,
                    )
                )
                break  # 첫 번째 발견된 것만 사용

        # 3. Rules: <project_root>/.claude/rules/*.md
        rules_dir = project_root / ".claude" / "rules"
        if rules_dir.is_dir():
            for rule_file in sorted(rules_dir.glob("*.md")):
                if rule_file.is_file():
                    files.append(
                        MemoryFileInfo(
                            name=rule_file.name,
                            relative_path=f"rules/{rule_file.name}",
                            source=SOURCE_RULES,
                            size_bytes=rule_file.stat().st_size,
                        )
                    )

        # 4. Serena Memory: <project_root>/.serena/memories/*.md
        serena_dir = project_root / ".serena" / "memories"
        if serena_dir.is_dir():
            for serena_file in sorted(serena_dir.glob("*.md")):
                if serena_file.is_file():
                    files.append(
                        MemoryFileInfo(
                            name=serena_file.name,
                            relative_path=f"serena-memory/{serena_file.name}",
                            source=SOURCE_SERENA_MEMORY,
                            size_bytes=serena_file.stat().st_size,
                        )
                    )

        return files

    def _read_memory_file_sync(
        self, local_path: str, relative_path: str
    ) -> MemoryFileContent | None:
        """단일 Memory 파일 읽기 (블로킹 I/O)."""
        abs_path = self._resolve_path(local_path, relative_path)
        if not abs_path or not abs_path.is_file():
            return None

        try:
            content = abs_path.read_text(encoding="utf-8")
            prefix = relative_path.split("/")[0]
            source = PREFIX_TO_SOURCE.get(prefix, prefix)
            return MemoryFileContent(
                name=abs_path.name,
                relative_path=relative_path,
                source=source,
                content=content,
            )
        except Exception:
            logger.warning("Memory 파일 읽기 실패: %s", abs_path)
            return None

    def _read_multiple_files_sync(
        self, local_path: str, relative_paths: list[str]
    ) -> list[MemoryFileContent | None]:
        """여러 Memory 파일 일괄 읽기 (P3: 단일 thread 호출)."""
        return [
            self._read_memory_file_sync(local_path, rp)
            for rp in relative_paths
        ]

    # ── 비동기 퍼블릭 API ─────────────────────────────────

    async def list_memory_files(self, local_path: str) -> list[MemoryFileInfo]:
        """워크스페이스에 연결된 모든 Claude Memory 파일 목록."""
        if not local_path or not local_path.strip():
            logger.warning("local_path가 비어 있어 Memory 파일을 조회할 수 없습니다.")
            return []

        cache_key = f"list:{local_path}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        files = await asyncio.to_thread(self._list_memory_files_sync, local_path)
        self._set_cached(cache_key, files)
        return files

    async def read_memory_file(
        self, local_path: str, relative_path: str
    ) -> MemoryFileContent | None:
        """특정 Memory 파일 내용 읽기.

        Args:
            local_path: 워크스페이스 로컬 경로
            relative_path: list_memory_files에서 반환된 relative_path
        """
        if not local_path or not local_path.strip():
            return None
        return await asyncio.to_thread(
            self._read_memory_file_sync, local_path, relative_path
        )

    async def build_memory_context(
        self, local_path: str, limit: int | None = None
    ) -> MemoryContextResponse:
        """세션 컨텍스트용 Memory 요약 텍스트 생성."""
        if not local_path or not local_path.strip():
            return MemoryContextResponse(memory_files=[], context_text="")

        if limit is None:
            limit = self.DEFAULT_FILE_LIMIT

        cache_key = f"context:{local_path}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        files = await self.list_memory_files(local_path)

        # 소스 우선순위 → 파일 크기 오름차순 정렬
        files.sort(
            key=lambda f: (
                self.SOURCE_PRIORITY.get(f.source, 99),
                f.size_bytes,
            )
        )

        # P3: 일괄 파일 읽기 — 단일 thread 호출로 N번 스위칭 방지
        target_files = files[:limit]
        contents = await asyncio.to_thread(
            self._read_multiple_files_sync,
            local_path,
            [f.relative_path for f in target_files],
        )

        parts: list[str] = []
        for content_obj in contents:
            if content_obj and content_obj.content.strip():
                text = content_obj.content[: self.MAX_CHARS_PER_FILE]
                if len(content_obj.content) > self.MAX_CHARS_PER_FILE:
                    text += "\n..."
                parts.append(f"## {content_obj.name}\n{text}")

        context_text = "\n\n".join(parts) if parts else ""
        if len(context_text) > self.MAX_TOTAL_CHARS:
            context_text = context_text[: self.MAX_TOTAL_CHARS - 3] + "..."

        result = MemoryContextResponse(
            memory_files=target_files,
            context_text=context_text,
        )
        self._set_cached(cache_key, result)
        return result

    # ── 경로 해석 유틸리티 ────────────────────────────────

    @staticmethod
    def _is_within(child: Path, parent: Path) -> bool:
        """child가 parent 디렉토리 내부에 있는지 검증 (Path Traversal 방지)."""
        try:
            child.resolve().relative_to(parent.resolve())
            return True
        except ValueError:
            return False

    def _resolve_path(self, local_path: str, relative_path: str) -> Path | None:
        """relative_path를 실제 파일시스템 경로로 변환 (경계 검증 포함)."""
        parts = relative_path.split("/", 1)
        if len(parts) != 2:
            return None

        prefix, filename = parts
        project_root = Path(local_path)
        encoded = self.encode_project_path(local_path)

        if prefix == "auto-memory":
            boundary = self.CLAUDE_HOME / "projects" / encoded / "memory"
            resolved = (boundary / filename).resolve()
            if not self._is_within(resolved, boundary):
                logger.warning("Path Traversal 시도 차단: %s", relative_path)
                return None
            return resolved
        elif prefix == "project":
            for candidate in [
                project_root / filename,
                project_root / ".claude" / filename,
            ]:
                resolved = candidate.resolve()
                if self._is_within(resolved, project_root) and resolved.is_file():
                    return resolved
            return None
        elif prefix == "rules":
            boundary = project_root / ".claude" / "rules"
            resolved = (boundary / filename).resolve()
            if not self._is_within(resolved, boundary):
                logger.warning("Path Traversal 시도 차단: %s", relative_path)
                return None
            return resolved
        elif prefix == "serena-memory":
            boundary = project_root / ".serena" / "memories"
            resolved = (boundary / filename).resolve()
            if not self._is_within(resolved, boundary):
                logger.warning("Path Traversal 시도 차단: %s", relative_path)
                return None
            return resolved
        return None
