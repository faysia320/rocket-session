"""Tests for ContextBuilderService."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.context_builder_service import ContextBuilderService, STOP_WORDS
from app.services.claude_memory_service import ClaudeMemoryService
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

        assert "Memory Content" in result["context_text"]
        assert "Recent Sessions" in result["context_text"]
        assert "Suggested Files" in result["context_text"]
        assert "src/auth.py" in result["context_text"]
        assert isinstance(result["memory_files"], list)
        assert isinstance(result["recent_sessions"], list)
        assert isinstance(result["suggested_files"], list)

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
        assert result["context_text"] == ""
        assert result["memory_files"] == []
        assert result["recent_sessions"] == []
        assert result["suggested_files"] == []
