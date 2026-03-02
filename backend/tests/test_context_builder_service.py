"""Tests for ContextBuilderService."""

import time
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.context_builder_service import ContextBuilderService, STOP_WORDS
from app.services.claude_memory_service import (
    ClaudeMemoryService,
    SOURCE_AUTO_MEMORY,
    SOURCE_CLAUDE_MD,
    SOURCE_RULES,
    SOURCE_SERENA_MEMORY,
    PREFIX_TO_SOURCE,
)
from app.schemas.claude_memory import MemoryContextResponse


class TestExtractKeywords:
    """Tests for _extract_keywords static method."""

    def test_basic_extraction(self):
        result = ContextBuilderService._extract_keywords("Fix authentication bug in login")
        assert "fix" in result
        assert "authentication" in result
        assert "bug" in result
        assert "login" in result

    def test_stopword_removal_english(self):
        result = ContextBuilderService._extract_keywords("the bug is in the code")
        assert "the" not in result
        assert "is" not in result
        assert "in" not in result
        assert "bug" in result
        assert "code" in result

    def test_stopword_removal_korean(self):
        """Korean stopwords are filtered; attached particles stay as part of token."""
        result = ContextBuilderService._extract_keywords("인증 버그 수정 의 를")
        # Standalone stopwords removed
        assert "의" not in result
        assert "를" not in result
        # Content words preserved
        assert "인증" in result
        assert "버그" in result
        assert "수정" in result

    def test_short_tokens_filtered(self):
        """Tokens shorter than 2 chars should be filtered."""
        result = ContextBuilderService._extract_keywords("I x y bug")
        # "I" → lowered to "i" (1 char), "x" (1 char), "y" (1 char) all filtered
        assert "bug" in result
        for token in result:
            assert len(token) >= 2

    def test_empty_string(self):
        assert ContextBuilderService._extract_keywords("") == []

    def test_numbers_and_special_chars_ignored(self):
        result = ContextBuilderService._extract_keywords("fix bug #123 in v2.0")
        assert "fix" in result
        assert "bug" in result
        # Numbers shouldn't appear
        assert "123" not in result
        assert "2" not in result

    def test_underscore_tokens(self):
        result = ContextBuilderService._extract_keywords("check user_name and api_key")
        assert "user_name" in result
        assert "api_key" in result

    def test_all_stopwords(self):
        """Verify the STOP_WORDS set contains expected entries."""
        assert "the" in STOP_WORDS
        assert "는" in STOP_WORDS
        assert "은" in STOP_WORDS


class TestSuggestFilesScoring:
    """Tests for the scoring logic in suggest_files.

    We mock DB interactions to isolate the scoring algorithm.
    """

    @pytest.fixture
    def service(self):
        mock_db = MagicMock()
        mock_memory = MagicMock(spec=ClaudeMemoryService)
        return ContextBuilderService(mock_db, mock_memory)

    @pytest.mark.asyncio
    async def test_no_sessions_returns_empty(self, service):
        """No sessions for workspace → empty suggestions."""
        # Mock DB to return empty session list
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.all.return_value = []
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)
        service._db.session = MagicMock(return_value=mock_ctx)

        result = await service.suggest_files("ws-1", prompt="test")
        assert result == []


class TestBuildFullContext:
    """Tests for build_full_context integration."""

    @pytest.fixture
    def service(self):
        mock_db = MagicMock()
        mock_memory = MagicMock(spec=ClaudeMemoryService)
        svc = ContextBuilderService(mock_db, mock_memory)
        return svc

    @pytest.mark.asyncio
    async def test_assembles_all_parts(self, service):
        """Should combine memory, sessions, and files into context_text."""
        # Mock _get_local_path
        service._get_local_path = AsyncMock(return_value="/test/path")

        # Mock memory context
        service._memory_service.build_memory_context = AsyncMock(
            return_value=MemoryContextResponse(
                memory_files=[],
                context_text="## Memory Content\nSome knowledge",
            )
        )

        # Mock recent sessions
        service.get_recent_sessions = AsyncMock(
            return_value=[
                {
                    "id": "sess-1",
                    "name": "Test Session",
                    "status": "completed",
                    "created_at": "2026-01-01T00:00:00",
                    "prompt_preview": "Fix the auth bug",
                    "file_count": 3,
                },
            ]
        )

        # Mock suggest files
        service.suggest_files = AsyncMock(
            return_value=[
                {
                    "file_path": "src/auth.py",
                    "reason": "3회 변경됨",
                    "score": 0.8,
                },
            ]
        )

        result = await service.build_full_context("ws-1", prompt="auth fix")

        assert "Memory Content" in result.context_text
        assert "Recent Sessions" in result.context_text
        assert "Suggested Files" in result.context_text
        assert "src/auth.py" in result.context_text
        assert isinstance(result.memory_files, list)
        assert isinstance(result.recent_sessions, list)
        assert isinstance(result.suggested_files, list)

    @pytest.mark.asyncio
    async def test_empty_memory_context(self, service):
        """Should handle empty memory gracefully."""
        service._get_local_path = AsyncMock(return_value="")
        service._memory_service.build_memory_context = AsyncMock(
            return_value=MemoryContextResponse(memory_files=[], context_text="")
        )
        service.get_recent_sessions = AsyncMock(return_value=[])
        service.suggest_files = AsyncMock(return_value=[])

        result = await service.build_full_context("ws-1")
        assert result.context_text == ""
        assert result.memory_files == []
        assert result.recent_sessions == []
        assert result.suggested_files == []

    @pytest.mark.asyncio
    async def test_returns_pydantic_model(self, service):
        """build_full_context should return SessionContextSuggestion, not dict."""
        from app.schemas.context import SessionContextSuggestion

        service._get_local_path = AsyncMock(return_value="/test")
        service._memory_service.build_memory_context = AsyncMock(
            return_value=MemoryContextResponse(memory_files=[], context_text="")
        )
        service.get_recent_sessions = AsyncMock(return_value=[])
        service.suggest_files = AsyncMock(return_value=[])

        result = await service.build_full_context("ws-1")
        assert isinstance(result, SessionContextSuggestion)

    @pytest.mark.asyncio
    async def test_parallel_execution(self, service):
        """build_full_context should call all 3 sub-methods (via asyncio.gather)."""
        service._get_local_path = AsyncMock(return_value="/test")
        service._memory_service.build_memory_context = AsyncMock(
            return_value=MemoryContextResponse(memory_files=[], context_text="")
        )
        service.get_recent_sessions = AsyncMock(return_value=[])
        service.suggest_files = AsyncMock(return_value=[])

        await service.build_full_context("ws-1", prompt="test")

        service._memory_service.build_memory_context.assert_called_once_with("/test")
        service.get_recent_sessions.assert_called_once_with("ws-1", limit=5)
        service.suggest_files.assert_called_once_with("ws-1", "test", limit=10)


class TestGetLocalPath:
    """Tests for _get_local_path with TTL cache."""

    @pytest.fixture
    def service(self):
        mock_db = MagicMock()
        mock_memory = MagicMock(spec=ClaudeMemoryService)
        return ContextBuilderService(mock_db, mock_memory)

    @pytest.mark.asyncio
    async def test_cache_hit(self, service):
        """Second call should use cache, not DB."""
        # Set up DB mock
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = "/test/path"
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)
        service._db.session = MagicMock(return_value=mock_ctx)

        result1 = await service._get_local_path("ws-1")
        result2 = await service._get_local_path("ws-1")

        assert result1 == "/test/path"
        assert result2 == "/test/path"
        # DB should only be called once
        assert mock_session.execute.call_count == 1

    @pytest.mark.asyncio
    async def test_cache_expiry(self, service):
        """Expired cache should trigger new DB call."""
        service._LOCAL_PATH_CACHE_TTL = 0.01  # 10ms

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = "/test/path"
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)
        service._db.session = MagicMock(return_value=mock_ctx)

        await service._get_local_path("ws-1")
        time.sleep(0.02)
        await service._get_local_path("ws-1")

        assert mock_session.execute.call_count == 2

    @pytest.mark.asyncio
    async def test_empty_local_path(self, service):
        """Missing workspace returns empty string."""
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = None  # workspace not found
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)
        service._db.session = MagicMock(return_value=mock_ctx)

        result = await service._get_local_path("nonexistent")
        assert result == ""


class TestInvalidateCaches:
    """Tests for invalidate_caches (service-level cache coordination)."""

    @pytest.fixture
    def service(self):
        mock_db = MagicMock()
        mock_memory = ClaudeMemoryService()
        return ContextBuilderService(mock_db, mock_memory)

    def test_invalidate_all(self, service):
        """Full invalidation clears both service caches."""
        service._local_path_cache["ws-1"] = (time.time(), "/test")
        service._memory_service._set_cached("list:/test", ["file1"])

        service.invalidate_caches()

        assert len(service._local_path_cache) == 0
        assert len(service._memory_service._cache) == 0

    def test_invalidate_by_workspace(self, service):
        """Workspace-specific invalidation clears only that workspace."""
        service._local_path_cache["ws-1"] = (time.time(), "/test1")
        service._local_path_cache["ws-2"] = (time.time(), "/test2")
        service._memory_service._set_cached("list:/test1", ["file1"])
        service._memory_service._set_cached("context:/test1", "ctx1")
        service._memory_service._set_cached("list:/test2", ["file2"])

        service.invalidate_caches("ws-1")

        # ws-1 cache should be gone
        assert "ws-1" not in service._local_path_cache
        assert service._memory_service._get_cached("list:/test1") is None
        assert service._memory_service._get_cached("context:/test1") is None
        # ws-2 cache should remain
        assert "ws-2" in service._local_path_cache
        assert service._memory_service._get_cached("list:/test2") is not None

    def test_invalidate_workspace_not_cached(self, service):
        """Invalidating uncached workspace should not error."""
        service.invalidate_caches("ws-unknown")  # Should not raise


class TestSourceConstants:
    """Tests for T6: source string constants."""

    def test_source_constants_exist(self):
        assert SOURCE_AUTO_MEMORY == "auto_memory"
        assert SOURCE_CLAUDE_MD == "claude_md"
        assert SOURCE_RULES == "rules"
        assert SOURCE_SERENA_MEMORY == "serena_memory"

    def test_prefix_to_source_mapping(self):
        assert PREFIX_TO_SOURCE["auto-memory"] == SOURCE_AUTO_MEMORY
        assert PREFIX_TO_SOURCE["project"] == SOURCE_CLAUDE_MD
        assert PREFIX_TO_SOURCE["rules"] == SOURCE_RULES
        assert PREFIX_TO_SOURCE["serena-memory"] == SOURCE_SERENA_MEMORY

    def test_source_priority_uses_constants(self):
        svc = ClaudeMemoryService()
        assert SOURCE_AUTO_MEMORY in svc.SOURCE_PRIORITY
        assert SOURCE_CLAUDE_MD in svc.SOURCE_PRIORITY
        assert SOURCE_RULES in svc.SOURCE_PRIORITY
        assert SOURCE_SERENA_MEMORY in svc.SOURCE_PRIORITY


class TestBatchFileReading:
    """Tests for P3: _read_multiple_files_sync."""

    @pytest.fixture
    def service_with_files(self, tmp_path):
        """Create a service with real files for batch reading."""
        svc = ClaudeMemoryService()
        svc._cache.clear()

        project = tmp_path / "project"
        project.mkdir()

        # CLAUDE.md
        (project / "CLAUDE.md").write_text("# Project", encoding="utf-8")

        # Rules
        rules_dir = project / ".claude" / "rules"
        rules_dir.mkdir(parents=True)
        (rules_dir / "style.md").write_text("# Style", encoding="utf-8")

        return svc, project

    def test_batch_reads_multiple_files(self, service_with_files):
        svc, project = service_with_files
        results = svc._read_multiple_files_sync(
            str(project),
            ["project/CLAUDE.md", "rules/style.md"],
        )
        assert len(results) == 2
        assert results[0] is not None
        assert results[0].name == "CLAUDE.md"
        assert results[1] is not None
        assert results[1].name == "style.md"

    def test_batch_handles_missing_file(self, service_with_files):
        svc, project = service_with_files
        results = svc._read_multiple_files_sync(
            str(project),
            ["project/CLAUDE.md", "rules/nonexistent.md"],
        )
        assert len(results) == 2
        assert results[0] is not None
        assert results[1] is None

    def test_batch_empty_list(self, service_with_files):
        svc, project = service_with_files
        results = svc._read_multiple_files_sync(str(project), [])
        assert results == []
