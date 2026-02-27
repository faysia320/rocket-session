"""Claude Code Memory 파일 읽기 서비스.

Claude Code가 자동으로 생성/관리하는 Memory 파일들을 읽어서
워크스페이스 Knowledge Base에 통합한다.

Memory 파일 위치:
- Auto Memory: ~/.claude/projects/<encoded-path>/memory/*.md
- CLAUDE.md: <project_root>/claude.md 또는 <project_root>/.claude/CLAUDE.md
- Rules: <project_root>/.claude/rules/*.md
"""

import logging
from pathlib import Path

from app.schemas.claude_memory import (
    MemoryContextResponse,
    MemoryFileContent,
    MemoryFileInfo,
)

logger = logging.getLogger(__name__)


class ClaudeMemoryService:
    """Claude Code Memory 파일시스템 읽기 서비스."""

    CLAUDE_HOME = Path.home() / ".claude"

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

    async def list_memory_files(self, local_path: str) -> list[MemoryFileInfo]:
        """워크스페이스에 연결된 모든 Claude Memory 파일 목록."""
        if not local_path or not local_path.strip():
            logger.warning("local_path가 비어 있어 Memory 파일을 조회할 수 없습니다.")
            return []

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
                            source="auto_memory",
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
                        source="claude_md",
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
                            source="rules",
                            size_bytes=rule_file.stat().st_size,
                        )
                    )

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

        abs_path = self._resolve_path(local_path, relative_path)
        if not abs_path or not abs_path.is_file():
            return None

        try:
            content = abs_path.read_text(encoding="utf-8")
            source = relative_path.split("/")[0]
            source_map = {
                "auto-memory": "auto_memory",
                "project": "claude_md",
                "rules": "rules",
            }
            return MemoryFileContent(
                name=abs_path.name,
                relative_path=relative_path,
                source=source_map.get(source, source),
                content=content,
            )
        except Exception:
            logger.warning("Memory 파일 읽기 실패: %s", abs_path)
            return None

    async def build_memory_context(
        self, local_path: str, limit: int = 5
    ) -> MemoryContextResponse:
        """세션 컨텍스트용 Memory 요약 텍스트 생성."""
        if not local_path or not local_path.strip():
            return MemoryContextResponse(memory_files=[], context_text="")

        files = await self.list_memory_files(local_path)
        parts: list[str] = []

        for f in files[:limit]:
            content_obj = await self.read_memory_file(local_path, f.relative_path)
            if content_obj and content_obj.content.strip():
                # 각 파일 내용을 최대 1000자로 제한
                text = content_obj.content[:1000]
                if len(content_obj.content) > 1000:
                    text += "\n..."
                parts.append(f"## {f.name}\n{text}")

        context_text = "\n\n".join(parts) if parts else ""
        # 전체 컨텍스트 최대 3000자
        if len(context_text) > 3000:
            context_text = context_text[:2997] + "..."

        return MemoryContextResponse(
            memory_files=files[:limit],
            context_text=context_text,
        )

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
        return None
