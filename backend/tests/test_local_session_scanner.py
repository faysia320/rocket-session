"""Tests for LocalSessionScanner."""

import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.schemas.local_session import ImportLocalSessionResponse, LocalSessionMeta
from app.services.local_session_scanner import (
    LocalSessionScanner,
    _get_claude_projects_dir,
    _validate_safe_path,
)


@pytest.fixture
def temp_projects_dir():
    """Create temporary projects directory structure."""
    with tempfile.TemporaryDirectory() as tmpdir:
        projects_dir = Path(tmpdir) / "projects"
        projects_dir.mkdir()
        yield projects_dir


@pytest.fixture
def sample_jsonl_content():
    """Sample JSONL content for testing."""
    return [
        {
            "type": "summary",
            "sessionId": "abc123",
            "cwd": "/home/user/project",
            "gitBranch": "main",
            "version": "1.0.0",
            "slug": "test-project",
            "timestamp": "2024-01-01T00:00:00Z",
        },
        {
            "type": "user",
            "message": {"role": "user", "content": "Hello"},
            "timestamp": "2024-01-01T00:01:00Z",
        },
        {
            "type": "assistant",
            "message": {
                "role": "assistant",
                "content": [{"type": "text", "text": "Hi there!"}],
            },
            "timestamp": "2024-01-01T00:02:00Z",
        },
        {
            "type": "user",
            "message": {"role": "user", "content": "How are you?"},
            "timestamp": "2024-01-01T00:03:00Z",
        },
    ]


def write_jsonl(path: Path, content: list[dict]):
    """Write JSONL file from list of dicts."""
    with open(path, "w", encoding="utf-8") as f:
        for obj in content:
            # Write without spaces after colons to match scanner's string matching
            f.write(json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + "\n")


class TestValidateSafePath:
    """Tests for _validate_safe_path helper function."""

    def test_validate_safe_path_success(self, temp_projects_dir):
        """Valid path within base directory."""
        result = _validate_safe_path(temp_projects_dir, "project1", "session.jsonl")
        # Use resolve() to handle Windows short path names (8.3 format)
        assert str(result.resolve()).startswith(str(temp_projects_dir.resolve()))

    def test_validate_safe_path_traversal_attack(self, temp_projects_dir):
        """Path traversal attack should raise ValueError."""
        with pytest.raises(ValueError, match="허용되지 않은 경로"):
            _validate_safe_path(temp_projects_dir, "..", "..", "etc", "passwd")


class TestExtractMetadata:
    """Tests for _extract_metadata method."""

    @pytest.mark.asyncio
    async def test_extract_metadata_success(
        self, db, temp_projects_dir, sample_jsonl_content
    ):
        """Extract metadata from valid JSONL file."""
        scanner = LocalSessionScanner(db)
        project_dir = temp_projects_dir / "test-project"
        project_dir.mkdir()
        jsonl_path = project_dir / "abc123.jsonl"
        write_jsonl(jsonl_path, sample_jsonl_content)

        result = scanner._extract_metadata(jsonl_path, "test-project", set())

        assert result is not None
        meta, _parent_id = result
        assert meta.session_id == "abc123"
        assert meta.project_dir == "test-project"
        assert meta.cwd == "/home/user/project"
        assert meta.git_branch == "main"
        assert meta.version == "1.0.0"
        assert meta.slug == "test-project"
        assert meta.first_timestamp == "2024-01-01T00:00:00Z"
        assert meta.last_timestamp == "2024-01-01T00:03:00Z"
        assert meta.message_count == 3  # user + assistant + user
        assert meta.file_size > 0
        assert meta.already_imported is False

    @pytest.mark.asyncio
    async def test_extract_metadata_empty_file_fallback_cwd(
        self, db, temp_projects_dir
    ):
        """Empty file should return metadata with fallback cwd from project_dir."""
        scanner = LocalSessionScanner(db)
        project_dir = temp_projects_dir / "home--user--project"
        project_dir.mkdir()
        jsonl_path = project_dir / "empty123.jsonl"
        jsonl_path.touch()

        result = scanner._extract_metadata(jsonl_path, "home--user--project", set())

        assert result is not None
        meta, _parent_id = result
        assert meta.session_id == "empty123"
        assert meta.cwd == "home/user/project"  # -- → /, - → /
        assert meta.message_count == 0

    @pytest.mark.asyncio
    async def test_extract_metadata_skip_invalid_json(
        self, db, temp_projects_dir, sample_jsonl_content
    ):
        """Invalid JSON lines should be skipped."""
        scanner = LocalSessionScanner(db)
        project_dir = temp_projects_dir / "test-project"
        project_dir.mkdir()
        jsonl_path = project_dir / "invalid123.jsonl"

        # Write valid and invalid lines
        with open(jsonl_path, "w", encoding="utf-8") as f:
            f.write(json.dumps(sample_jsonl_content[0], separators=(',', ':')) + "\n")
            f.write("invalid json line\n")
            f.write(json.dumps(sample_jsonl_content[1], separators=(',', ':')) + "\n")

        result = scanner._extract_metadata(jsonl_path, "test-project", set())

        assert result is not None
        meta, _parent_id = result
        assert meta.cwd == "/home/user/project"
        assert meta.message_count == 1  # Only valid user message counted

    @pytest.mark.asyncio
    async def test_extract_metadata_already_imported_flag(
        self, db, temp_projects_dir, sample_jsonl_content
    ):
        """already_imported flag should be set if session_id in imported_ids."""
        scanner = LocalSessionScanner(db)
        project_dir = temp_projects_dir / "test-project"
        project_dir.mkdir()
        jsonl_path = project_dir / "abc123.jsonl"
        write_jsonl(jsonl_path, sample_jsonl_content)

        imported_ids = {"abc123"}
        result = scanner._extract_metadata(jsonl_path, "test-project", imported_ids)

        assert result is not None
        meta, _parent_id = result
        assert meta.already_imported is True


class TestParseMessages:
    """Tests for _parse_messages method."""

    @pytest.mark.asyncio
    async def test_parse_messages_user_assistant(self, db, temp_projects_dir):
        """Parse user and assistant messages."""
        scanner = LocalSessionScanner(db)
        jsonl_path = temp_projects_dir / "test.jsonl"
        content = [
            {
                "type": "user",
                "message": {"role": "user", "content": "Hello"},
                "timestamp": "2024-01-01T00:00:00Z",
            },
            {
                "type": "assistant",
                "message": {"role": "assistant", "content": "Hi there!"},
                "timestamp": "2024-01-01T00:01:00Z",
            },
        ]
        write_jsonl(jsonl_path, content)

        messages = scanner._parse_messages(jsonl_path)

        assert len(messages) == 2
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "Hello"
        assert messages[0]["timestamp"] == "2024-01-01T00:00:00Z"
        assert messages[1]["role"] == "assistant"
        assert messages[1]["content"] == "Hi there!"

    @pytest.mark.asyncio
    async def test_parse_messages_content_array_text_extraction(
        self, db, temp_projects_dir
    ):
        """Extract text from content array."""
        scanner = LocalSessionScanner(db)
        jsonl_path = temp_projects_dir / "test.jsonl"
        content = [
            {
                "type": "assistant",
                "message": {
                    "role": "assistant",
                    "content": [
                        {"type": "text", "text": "First part"},
                        {"type": "text", "text": "Second part"},
                    ],
                },
                "timestamp": "2024-01-01T00:00:00Z",
            },
        ]
        write_jsonl(jsonl_path, content)

        messages = scanner._parse_messages(jsonl_path)

        assert len(messages) == 1
        assert messages[0]["content"] == "First part\nSecond part"

    @pytest.mark.asyncio
    async def test_parse_messages_skip_is_meta(self, db, temp_projects_dir):
        """Skip messages with isMeta flag."""
        scanner = LocalSessionScanner(db)
        jsonl_path = temp_projects_dir / "test.jsonl"
        content = [
            {
                "type": "user",
                "message": {"role": "user", "content": "Normal message"},
                "timestamp": "2024-01-01T00:00:00Z",
            },
            {
                "type": "user",
                "message": {"role": "user", "content": "/system command"},
                "isMeta": True,
                "timestamp": "2024-01-01T00:01:00Z",
            },
        ]
        write_jsonl(jsonl_path, content)

        messages = scanner._parse_messages(jsonl_path)

        assert len(messages) == 1
        assert messages[0]["content"] == "Normal message"

    @pytest.mark.asyncio
    async def test_parse_messages_skip_empty_content(self, db, temp_projects_dir):
        """Skip messages with empty content."""
        scanner = LocalSessionScanner(db)
        jsonl_path = temp_projects_dir / "test.jsonl"
        content = [
            {
                "type": "user",
                "message": {"role": "user", "content": "Valid message"},
                "timestamp": "2024-01-01T00:00:00Z",
            },
            {
                "type": "user",
                "message": {"role": "user", "content": ""},
                "timestamp": "2024-01-01T00:01:00Z",
            },
            {
                "type": "user",
                "message": {"role": "user", "content": "   "},
                "timestamp": "2024-01-01T00:02:00Z",
            },
        ]
        write_jsonl(jsonl_path, content)

        messages = scanner._parse_messages(jsonl_path)

        assert len(messages) == 1
        assert messages[0]["content"] == "Valid message"


class TestScan:
    """Tests for scan method."""

    @pytest.mark.asyncio
    async def test_scan_success_all_projects(
        self, db, temp_projects_dir, sample_jsonl_content
    ):
        """Scan all projects successfully."""
        scanner = LocalSessionScanner(db)

        # Create two projects with sessions
        project1 = temp_projects_dir / "project1"
        project1.mkdir()
        write_jsonl(project1 / "session1.jsonl", sample_jsonl_content)

        project2 = temp_projects_dir / "project2"
        project2.mkdir()
        write_jsonl(project2 / "session2.jsonl", sample_jsonl_content)

        with patch(
            "app.services.local_session_scanner._get_claude_projects_dir",
            return_value=temp_projects_dir,
        ):
            results = await scanner.scan()

        assert len(results) == 2
        assert {r.session_id for r in results} == {"session1", "session2"}

    @pytest.mark.asyncio
    async def test_scan_specific_project(
        self, db, temp_projects_dir, sample_jsonl_content
    ):
        """Scan specific project only."""
        scanner = LocalSessionScanner(db)

        project1 = temp_projects_dir / "project1"
        project1.mkdir()
        write_jsonl(project1 / "session1.jsonl", sample_jsonl_content)

        project2 = temp_projects_dir / "project2"
        project2.mkdir()
        write_jsonl(project2 / "session2.jsonl", sample_jsonl_content)

        with patch(
            "app.services.local_session_scanner._get_claude_projects_dir",
            return_value=temp_projects_dir,
        ):
            results = await scanner.scan(project_dir="project1")

        assert len(results) == 1
        assert results[0].session_id == "session1"
        assert results[0].project_dir == "project1"

    @pytest.mark.asyncio
    async def test_scan_empty_directory(self, db, temp_projects_dir):
        """Scan empty directory returns empty list."""
        scanner = LocalSessionScanner(db)

        with patch(
            "app.services.local_session_scanner._get_claude_projects_dir",
            return_value=temp_projects_dir,
        ):
            results = await scanner.scan()

        assert results == []

    @pytest.mark.asyncio
    async def test_scan_nonexistent_directory(self, db, temp_projects_dir):
        """Scan nonexistent directory returns empty list."""
        scanner = LocalSessionScanner(db)
        nonexistent = temp_projects_dir / "nonexistent"

        with patch(
            "app.services.local_session_scanner._get_claude_projects_dir",
            return_value=nonexistent,
        ):
            results = await scanner.scan()

        assert results == []

    @pytest.mark.asyncio
    async def test_scan_already_imported_flag(
        self, db, session_manager, temp_projects_dir, sample_jsonl_content
    ):
        """already_imported flag should be set correctly."""
        scanner = LocalSessionScanner(db)

        # Create session and import it
        session = await session_manager.create(work_dir="/test")
        await session_manager.update_claude_session_id(
            session["id"], "imported_session"
        )

        # Create JSONL files
        project1 = temp_projects_dir / "project1"
        project1.mkdir()
        write_jsonl(project1 / "imported_session.jsonl", sample_jsonl_content)
        write_jsonl(project1 / "new_session.jsonl", sample_jsonl_content)

        with patch(
            "app.services.local_session_scanner._get_claude_projects_dir",
            return_value=temp_projects_dir,
        ):
            results = await scanner.scan(project_dir="project1")

        imported = next((r for r in results if r.session_id == "imported_session"), None)
        new = next((r for r in results if r.session_id == "new_session"), None)

        assert imported is not None
        assert imported.already_imported is True
        assert new is not None
        assert new.already_imported is False


class TestImportSession:
    """Tests for import_session method."""

    @pytest.mark.asyncio
    async def test_import_session_success(
        self, db, session_manager, temp_projects_dir, sample_jsonl_content
    ):
        """Import session successfully."""
        scanner = LocalSessionScanner(db)

        project_dir = temp_projects_dir / "test-project"
        project_dir.mkdir()
        jsonl_path = project_dir / "abc123.jsonl"
        write_jsonl(jsonl_path, sample_jsonl_content)

        with patch(
            "app.services.local_session_scanner._get_claude_projects_dir",
            return_value=temp_projects_dir,
        ):
            response = await scanner.import_session(
                "abc123", "test-project", session_manager
            )

        assert isinstance(response, ImportLocalSessionResponse)
        assert response.claude_session_id == "abc123"
        assert response.messages_imported == 3  # user + assistant + user
        assert response.dashboard_session_id is not None

        # Verify session was created
        session = await session_manager.get(response.dashboard_session_id)
        assert session is not None
        assert session["claude_session_id"] == "abc123"
        assert session["work_dir"] == "/home/user/project"

        # Verify messages were imported
        messages = await db.conn.execute(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp",
            (response.dashboard_session_id,),
        )
        messages = await messages.fetchall()
        assert len(messages) == 3

    @pytest.mark.asyncio
    async def test_import_session_duplicate(
        self, db, session_manager, temp_projects_dir, sample_jsonl_content
    ):
        """Import duplicate session should return existing session."""
        scanner = LocalSessionScanner(db)

        # Create existing session
        existing_session = await session_manager.create(work_dir="/test")
        await session_manager.update_claude_session_id(
            existing_session["id"], "abc123"
        )

        project_dir = temp_projects_dir / "test-project"
        project_dir.mkdir()
        jsonl_path = project_dir / "abc123.jsonl"
        write_jsonl(jsonl_path, sample_jsonl_content)

        with patch(
            "app.services.local_session_scanner._get_claude_projects_dir",
            return_value=temp_projects_dir,
        ):
            response = await scanner.import_session(
                "abc123", "test-project", session_manager
            )

        assert response.dashboard_session_id == existing_session["id"]
        assert response.claude_session_id == "abc123"
        assert response.messages_imported == 0  # No messages imported

    @pytest.mark.asyncio
    async def test_import_session_file_not_found(
        self, db, session_manager, temp_projects_dir
    ):
        """Import nonexistent session file should raise FileNotFoundError."""
        scanner = LocalSessionScanner(db)

        project_dir = temp_projects_dir / "test-project"
        project_dir.mkdir()

        with patch(
            "app.services.local_session_scanner._get_claude_projects_dir",
            return_value=temp_projects_dir,
        ):
            with pytest.raises(FileNotFoundError, match="JSONL 파일을 찾을 수 없습니다"):
                await scanner.import_session(
                    "nonexistent", "test-project", session_manager
                )
