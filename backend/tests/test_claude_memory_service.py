"""Tests for ClaudeMemoryService."""

import time

import pytest

from app.services.claude_memory_service import ClaudeMemoryService


@pytest.fixture
def service():
    """Fresh ClaudeMemoryService with cleared cache."""
    svc = ClaudeMemoryService()
    svc._cache.clear()
    return svc


@pytest.fixture
def workspace(tmp_path):
    """Create a temporary workspace with memory files from all 4 sources."""
    # Auto Memory: simulate ~/.claude/projects/<encoded>/memory/
    # We'll monkey-patch CLAUDE_HOME for testing
    claude_home = tmp_path / ".claude"
    encoded = ClaudeMemoryService.encode_project_path(str(tmp_path / "project"))
    memory_dir = claude_home / "projects" / encoded / "memory"
    memory_dir.mkdir(parents=True)
    (memory_dir / "MEMORY.md").write_text("# Auto Memory\nTest content", encoding="utf-8")
    (memory_dir / "patterns.md").write_text("# Patterns\nSome patterns", encoding="utf-8")

    # Project root
    project = tmp_path / "project"
    project.mkdir()

    # CLAUDE.md
    (project / "CLAUDE.md").write_text("# Project Guide\nProject rules", encoding="utf-8")

    # Rules
    rules_dir = project / ".claude" / "rules"
    rules_dir.mkdir(parents=True)
    (rules_dir / "style.md").write_text("# Style Rules\nUse tabs", encoding="utf-8")

    # Serena Memory
    serena_dir = project / ".serena" / "memories"
    serena_dir.mkdir(parents=True)
    (serena_dir / "architecture.md").write_text(
        "# Architecture\nService layer", encoding="utf-8"
    )

    return project, claude_home


class TestEncodeProjectPath:
    """Tests for encode_project_path static method."""

    def test_unix_path(self):
        assert ClaudeMemoryService.encode_project_path("/workspaces/rocket-session") == (
            "-workspaces-rocket-session"
        )

    def test_unix_path_nested(self):
        assert ClaudeMemoryService.encode_project_path("/home/user/projects/app") == (
            "-home-user-projects-app"
        )

    def test_windows_path(self):
        assert ClaudeMemoryService.encode_project_path("C:\\WorkSpace\\repos\\app") == (
            "C--WorkSpace-repos-app"
        )

    def test_windows_path_forward_slash(self):
        assert ClaudeMemoryService.encode_project_path("C:/Users/dev/project") == (
            "C--Users-dev-project"
        )

    def test_root_path(self):
        assert ClaudeMemoryService.encode_project_path("/") == "-"


class TestListMemoryFiles:
    """Tests for list_memory_files method."""

    @pytest.mark.asyncio
    async def test_all_four_sources(self, service, workspace):
        project, claude_home = workspace
        service.CLAUDE_HOME = claude_home

        files = await service.list_memory_files(str(project))

        sources = {f.source for f in files}
        assert "auto_memory" in sources
        assert "claude_md" in sources
        assert "rules" in sources
        assert "serena_memory" in sources

    @pytest.mark.asyncio
    async def test_auto_memory_files(self, service, workspace):
        project, claude_home = workspace
        service.CLAUDE_HOME = claude_home

        files = await service.list_memory_files(str(project))
        auto_files = [f for f in files if f.source == "auto_memory"]

        assert len(auto_files) == 2
        names = {f.name for f in auto_files}
        assert "MEMORY.md" in names
        assert "patterns.md" in names

    @pytest.mark.asyncio
    async def test_empty_workspace(self, service, tmp_path):
        """Workspace with no memory files returns empty list."""
        empty_dir = tmp_path / "empty_project"
        empty_dir.mkdir()

        files = await service.list_memory_files(str(empty_dir))
        assert files == []

    @pytest.mark.asyncio
    async def test_empty_local_path(self, service):
        """Empty local_path returns empty list."""
        assert await service.list_memory_files("") == []
        assert await service.list_memory_files("   ") == []

    @pytest.mark.asyncio
    async def test_file_size_bytes(self, service, workspace):
        project, claude_home = workspace
        service.CLAUDE_HOME = claude_home

        files = await service.list_memory_files(str(project))
        for f in files:
            assert f.size_bytes > 0

    @pytest.mark.asyncio
    async def test_relative_path_format(self, service, workspace):
        project, claude_home = workspace
        service.CLAUDE_HOME = claude_home

        files = await service.list_memory_files(str(project))
        prefixes = {f.relative_path.split("/")[0] for f in files}
        assert prefixes <= {"auto-memory", "project", "rules", "serena-memory"}

    @pytest.mark.asyncio
    async def test_claude_md_first_found(self, service, tmp_path):
        """Only the first CLAUDE.md candidate is used."""
        project = tmp_path / "proj"
        project.mkdir()
        (project / "CLAUDE.md").write_text("root", encoding="utf-8")
        claude_dir = project / ".claude"
        claude_dir.mkdir()
        (claude_dir / "CLAUDE.md").write_text("nested", encoding="utf-8")

        files = await service.list_memory_files(str(project))
        md_files = [f for f in files if f.source == "claude_md"]
        assert len(md_files) == 1
        assert md_files[0].name == "CLAUDE.md"


class TestReadMemoryFile:
    """Tests for read_memory_file method."""

    @pytest.mark.asyncio
    async def test_read_auto_memory(self, service, workspace):
        project, claude_home = workspace
        service.CLAUDE_HOME = claude_home

        content = await service.read_memory_file(str(project), "auto-memory/MEMORY.md")
        assert content is not None
        assert content.name == "MEMORY.md"
        assert content.source == "auto_memory"
        assert "Auto Memory" in content.content

    @pytest.mark.asyncio
    async def test_read_rules(self, service, workspace):
        project, claude_home = workspace
        service.CLAUDE_HOME = claude_home

        content = await service.read_memory_file(str(project), "rules/style.md")
        assert content is not None
        assert content.source == "rules"
        assert "Style Rules" in content.content

    @pytest.mark.asyncio
    async def test_read_serena_memory(self, service, workspace):
        project, claude_home = workspace
        service.CLAUDE_HOME = claude_home

        content = await service.read_memory_file(str(project), "serena-memory/architecture.md")
        assert content is not None
        assert content.source == "serena_memory"

    @pytest.mark.asyncio
    async def test_read_nonexistent(self, service, workspace):
        project, _ = workspace
        result = await service.read_memory_file(str(project), "auto-memory/nope.md")
        assert result is None

    @pytest.mark.asyncio
    async def test_read_invalid_prefix(self, service, workspace):
        project, _ = workspace
        result = await service.read_memory_file(str(project), "invalid/file.md")
        assert result is None

    @pytest.mark.asyncio
    async def test_read_empty_local_path(self, service):
        assert await service.read_memory_file("", "auto-memory/test.md") is None

    @pytest.mark.asyncio
    async def test_read_no_slash_relative_path(self, service, workspace):
        project, _ = workspace
        result = await service.read_memory_file(str(project), "no-slash")
        assert result is None


class TestPathTraversal:
    """Tests for _is_within and path traversal prevention."""

    def test_is_within_true(self, tmp_path):
        child = tmp_path / "sub" / "file.txt"
        assert ClaudeMemoryService._is_within(child, tmp_path) is True

    def test_is_within_false(self, tmp_path):
        child = tmp_path / ".." / "etc" / "passwd"
        assert ClaudeMemoryService._is_within(child, tmp_path) is False

    def test_is_within_same(self, tmp_path):
        assert ClaudeMemoryService._is_within(tmp_path, tmp_path) is True

    @pytest.mark.asyncio
    async def test_traversal_auto_memory(self, service, workspace):
        project, claude_home = workspace
        service.CLAUDE_HOME = claude_home

        result = await service.read_memory_file(str(project), "auto-memory/../../etc/passwd")
        assert result is None

    @pytest.mark.asyncio
    async def test_traversal_rules(self, service, workspace):
        project, _ = workspace
        result = await service.read_memory_file(str(project), "rules/../../etc/passwd")
        assert result is None

    @pytest.mark.asyncio
    async def test_traversal_serena(self, service, workspace):
        project, _ = workspace
        result = await service.read_memory_file(str(project), "serena-memory/../../etc/passwd")
        assert result is None


class TestBuildMemoryContext:
    """Tests for build_memory_context method."""

    @pytest.mark.asyncio
    async def test_basic_context_generation(self, service, workspace):
        project, claude_home = workspace
        service.CLAUDE_HOME = claude_home

        ctx = await service.build_memory_context(str(project))
        assert ctx.context_text
        assert len(ctx.memory_files) > 0

    @pytest.mark.asyncio
    async def test_source_priority_sorting(self, service, workspace):
        """auto_memory should come before serena_memory in context."""
        project, claude_home = workspace
        service.CLAUDE_HOME = claude_home

        ctx = await service.build_memory_context(str(project))
        # auto_memory (priority 0) files should appear before serena_memory (priority 3)
        auto_idx = ctx.context_text.find("Auto Memory")
        serena_idx = ctx.context_text.find("Architecture")
        if auto_idx >= 0 and serena_idx >= 0:
            assert auto_idx < serena_idx

    @pytest.mark.asyncio
    async def test_limit_parameter(self, service, workspace):
        project, claude_home = workspace
        service.CLAUDE_HOME = claude_home

        ctx = await service.build_memory_context(str(project), limit=2)
        assert len(ctx.memory_files) <= 5  # memory_files is from list, limited in iteration
        # context_text should only contain at most 2 files' content
        file_headers = ctx.context_text.count("## ")
        assert file_headers <= 2

    @pytest.mark.asyncio
    async def test_max_chars_per_file_truncation(self, service, workspace):
        """Files exceeding MAX_CHARS_PER_FILE should be truncated."""
        project, claude_home = workspace
        service.CLAUDE_HOME = claude_home

        # Create a large file
        encoded = service.encode_project_path(str(project))
        memory_dir = claude_home / "projects" / encoded / "memory"
        large_content = "A" * (service.MAX_CHARS_PER_FILE + 500)
        (memory_dir / "large.md").write_text(large_content, encoding="utf-8")
        service.invalidate_cache()

        ctx = await service.build_memory_context(str(project))
        # Should contain truncation marker
        assert "..." in ctx.context_text

    @pytest.mark.asyncio
    async def test_max_total_chars_truncation(self, service, workspace):
        """Total context should not exceed MAX_TOTAL_CHARS."""
        project, claude_home = workspace
        service.CLAUDE_HOME = claude_home
        service.MAX_TOTAL_CHARS = 100  # Force early truncation

        ctx = await service.build_memory_context(str(project))
        assert len(ctx.context_text) <= 100

    @pytest.mark.asyncio
    async def test_empty_workspace(self, service, tmp_path):
        empty_dir = tmp_path / "empty"
        empty_dir.mkdir()
        ctx = await service.build_memory_context(str(empty_dir))
        assert ctx.context_text == ""
        assert ctx.memory_files == []

    @pytest.mark.asyncio
    async def test_empty_local_path(self, service):
        ctx = await service.build_memory_context("")
        assert ctx.context_text == ""


class TestCaching:
    """Tests for in-memory TTL cache."""

    @pytest.mark.asyncio
    async def test_cache_hit(self, service, workspace):
        project, claude_home = workspace
        service.CLAUDE_HOME = claude_home

        files1 = await service.list_memory_files(str(project))
        files2 = await service.list_memory_files(str(project))
        assert files1 == files2

    @pytest.mark.asyncio
    async def test_cache_invalidate_all(self, service, workspace):
        project, claude_home = workspace
        service.CLAUDE_HOME = claude_home

        await service.list_memory_files(str(project))
        assert len(service._cache) > 0

        service.invalidate_cache()
        assert len(service._cache) == 0

    @pytest.mark.asyncio
    async def test_cache_invalidate_by_path(self, service, workspace):
        project, claude_home = workspace
        service.CLAUDE_HOME = claude_home

        await service.list_memory_files(str(project))
        service._set_cached("other:key", "data")

        service.invalidate_cache(str(project))
        # Project-related cache should be gone
        assert service._get_cached(f"list:{project}") is None
        # Unrelated cache should remain
        assert service._get_cached("other:key") == "data"

    @pytest.mark.asyncio
    async def test_cache_ttl_expiry(self, service, workspace):
        project, claude_home = workspace
        service.CLAUDE_HOME = claude_home

        # Set very short TTL
        service.CACHE_TTL_SECONDS = 0.01
        await service.list_memory_files(str(project))

        time.sleep(0.02)
        # Cache should be expired
        assert service._get_cached(f"list:{project}") is None
