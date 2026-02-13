"""SessionManager service tests."""

import asyncio
import json
import tempfile
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.session import SessionStatus
from app.schemas.session import SessionInfo


@pytest.mark.asyncio
class TestSessionManager:
    """SessionManager service test suite."""

    async def test_create_session(self, session_manager):
        """Test session creation with required fields."""
        work_dir = tempfile.gettempdir()
        session = await session_manager.create(
            work_dir=work_dir,
            allowed_tools="Read,Write",
            system_prompt="Test prompt",
            timeout_seconds=60,
        )

        assert session["id"]
        assert len(session["id"]) == 8  # UUID 8자리
        assert session["work_dir"] == work_dir
        assert session["status"] == SessionStatus.IDLE
        assert session["allowed_tools"] == "Read,Write"
        assert session["system_prompt"] == "Test prompt"
        assert session["timeout_seconds"] == 60
        assert session["created_at"]
        # Verify UTC timestamp format
        datetime.fromisoformat(session["created_at"])

    async def test_create_session_with_permission_tools_json_serialization(
        self, session_manager
    ):
        """Test permission_required_tools JSON serialization during creation."""
        work_dir = tempfile.gettempdir()
        perm_tools = ["Bash", "Write"]
        session = await session_manager.create(
            work_dir=work_dir,
            permission_mode=True,
            permission_required_tools=perm_tools,
        )

        assert session["id"]
        assert session["permission_mode"] == 1  # DB stores as int
        assert session["permission_required_tools"] == json.dumps(perm_tools)

    async def test_get_existing_session(self, session_manager):
        """Test retrieval of existing session."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(work_dir=work_dir)
        session_id = created["id"]

        session = await session_manager.get(session_id)

        assert session is not None
        assert session["id"] == session_id
        assert session["work_dir"] == work_dir

    async def test_get_nonexistent_session(self, session_manager):
        """Test retrieval of nonexistent session returns None."""
        session = await session_manager.get("nonexistent")
        assert session is None

    async def test_get_with_counts(self, session_manager):
        """Test get_with_counts includes message_count and file_changes_count."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(work_dir=work_dir)
        session_id = created["id"]

        # Add messages and file changes
        timestamp = datetime.now(timezone.utc).isoformat()
        await session_manager.add_message(
            session_id, "user", "Hello", timestamp
        )
        await session_manager.add_message(
            session_id, "assistant", "Hi", timestamp
        )
        await session_manager.add_file_change(
            session_id, "Write", "/test/file.txt", timestamp
        )

        session = await session_manager.get_with_counts(session_id)

        assert session is not None
        assert session["message_count"] == 2
        assert session["file_changes_count"] == 1

    async def test_list_all_sessions(self, session_manager):
        """Test listing multiple sessions."""
        work_dir = tempfile.gettempdir()
        s1 = await session_manager.create(work_dir=work_dir)
        s2 = await session_manager.create(work_dir=work_dir)

        sessions = await session_manager.list_all()

        assert len(sessions) >= 2
        session_ids = [s["id"] for s in sessions]
        assert s1["id"] in session_ids
        assert s2["id"] in session_ids

    async def test_delete_session_success(self, session_manager):
        """Test successful session deletion."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(work_dir=work_dir)
        session_id = created["id"]

        deleted = await session_manager.delete(session_id)

        assert deleted is True
        session = await session_manager.get(session_id)
        assert session is None

    async def test_delete_session_failure(self, session_manager):
        """Test deletion of nonexistent session returns False."""
        deleted = await session_manager.delete("nonexistent")
        assert deleted is False

    async def test_kill_process_cancels_runner_task(self, session_manager):
        """Test kill_process cancels runner task."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(work_dir=work_dir)
        session_id = created["id"]

        # Create mock task
        mock_task = MagicMock(spec=asyncio.Task)
        mock_task.done.return_value = False
        session_manager.set_runner_task(session_id, mock_task)

        await session_manager.kill_process(session_id)

        mock_task.cancel.assert_called_once()
        assert session_manager.get_runner_task(session_id) is None

    async def test_kill_process_terminates_process(self, session_manager):
        """Test kill_process terminates subprocess."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(work_dir=work_dir)
        session_id = created["id"]

        # Create mock process
        mock_process = AsyncMock(spec=asyncio.subprocess.Process)
        mock_process.returncode = None  # Still running
        mock_process.wait = AsyncMock()
        session_manager.set_process(session_id, mock_process)

        await session_manager.kill_process(session_id)

        mock_process.terminate.assert_called_once()
        mock_process.wait.assert_awaited_once()
        assert session_manager.get_process(session_id) is None

    async def test_kill_process_kills_on_timeout(self, session_manager):
        """Test kill_process uses kill() when terminate times out."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(work_dir=work_dir)
        session_id = created["id"]

        # Create mock process that times out
        mock_process = AsyncMock(spec=asyncio.subprocess.Process)
        mock_process.returncode = None
        mock_process.wait.side_effect = asyncio.TimeoutError()
        session_manager.set_process(session_id, mock_process)

        await session_manager.kill_process(session_id)

        mock_process.terminate.assert_called_once()
        mock_process.kill.assert_called_once()

    async def test_set_get_clear_process(self, session_manager):
        """Test process handle management."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(work_dir=work_dir)
        session_id = created["id"]

        mock_process = MagicMock(spec=asyncio.subprocess.Process)
        session_manager.set_process(session_id, mock_process)

        retrieved = session_manager.get_process(session_id)
        assert retrieved is mock_process

        session_manager.clear_process(session_id)
        assert session_manager.get_process(session_id) is None

    async def test_set_get_clear_runner_task(self, session_manager):
        """Test runner task management."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(work_dir=work_dir)
        session_id = created["id"]

        mock_task = MagicMock(spec=asyncio.Task)
        mock_task.done.return_value = False
        session_manager.set_runner_task(session_id, mock_task)

        retrieved = session_manager.get_runner_task(session_id)
        assert retrieved is mock_task

        session_manager.clear_runner_task(session_id)
        assert session_manager.get_runner_task(session_id) is None

    async def test_get_runner_task_auto_clears_completed_task(self, session_manager):
        """Test get_runner_task auto-clears completed tasks."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(work_dir=work_dir)
        session_id = created["id"]

        mock_task = MagicMock(spec=asyncio.Task)
        mock_task.done.return_value = True  # Task completed
        session_manager.set_runner_task(session_id, mock_task)

        retrieved = session_manager.get_runner_task(session_id)
        assert retrieved is None  # Auto-cleared
        # Verify second call also returns None
        assert session_manager.get_runner_task(session_id) is None

    async def test_update_status(self, session_manager):
        """Test status update."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(work_dir=work_dir)
        session_id = created["id"]

        await session_manager.update_status(session_id, SessionStatus.RUNNING)

        session = await session_manager.get(session_id)
        assert session["status"] == SessionStatus.RUNNING

    async def test_update_claude_session_id(self, session_manager):
        """Test claude_session_id update."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(work_dir=work_dir)
        session_id = created["id"]
        claude_id = "claude-123"

        await session_manager.update_claude_session_id(session_id, claude_id)

        session = await session_manager.get(session_id)
        assert session["claude_session_id"] == claude_id

    async def test_find_by_claude_session_id(self, session_manager):
        """Test find session by claude_session_id."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(work_dir=work_dir)
        session_id = created["id"]
        claude_id = "claude-456"

        await session_manager.update_claude_session_id(session_id, claude_id)
        found = await session_manager.find_by_claude_session_id(claude_id)

        assert found is not None
        assert found["id"] == session_id
        assert found["claude_session_id"] == claude_id

    async def test_add_message_and_get_history(self, session_manager):
        """Test adding messages and retrieving history."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(work_dir=work_dir)
        session_id = created["id"]
        timestamp = datetime.now(timezone.utc).isoformat()

        await session_manager.add_message(
            session_id,
            role="user",
            content="Hello",
            timestamp=timestamp,
        )
        await session_manager.add_message(
            session_id,
            role="assistant",
            content="Hi there",
            timestamp=timestamp,
            cost=0.001,
            duration_ms=500,
        )

        history = await session_manager.get_history(session_id)

        assert len(history) == 2
        assert history[0]["role"] == "user"
        assert history[0]["content"] == "Hello"
        assert history[1]["role"] == "assistant"
        assert history[1]["content"] == "Hi there"
        assert history[1]["cost"] == 0.001
        assert history[1]["duration_ms"] == 500

    async def test_add_file_change_and_get_file_changes(self, session_manager):
        """Test adding file changes and retrieving them."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(work_dir=work_dir)
        session_id = created["id"]
        timestamp = datetime.now(timezone.utc).isoformat()

        await session_manager.add_file_change(
            session_id,
            tool="Write",
            file="/path/to/file.txt",
            timestamp=timestamp,
        )
        await session_manager.add_file_change(
            session_id,
            tool="Edit",
            file="/path/to/other.py",
            timestamp=timestamp,
        )

        changes = await session_manager.get_file_changes(session_id)

        assert len(changes) == 2
        assert changes[0]["tool"] == "Write"
        assert changes[0]["file"] == "/path/to/file.txt"
        assert changes[1]["tool"] == "Edit"
        assert changes[1]["file"] == "/path/to/other.py"

    async def test_update_settings_partial(self, session_manager):
        """Test partial update of session settings."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(
            work_dir=work_dir,
            allowed_tools="Read",
            timeout_seconds=30,
        )
        session_id = created["id"]

        updated = await session_manager.update_settings(
            session_id,
            allowed_tools="Read,Write,Bash",
            name="Updated Session",
        )

        assert updated is not None
        assert updated["allowed_tools"] == "Read,Write,Bash"
        assert updated["name"] == "Updated Session"
        assert updated["timeout_seconds"] == 30  # Unchanged

    async def test_update_settings_permission_tools_serialization(self, session_manager):
        """Test update_settings serializes permission_required_tools to JSON."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(work_dir=work_dir)
        session_id = created["id"]
        perm_tools = ["Bash", "Edit"]

        updated = await session_manager.update_settings(
            session_id,
            permission_mode=True,
            permission_required_tools=perm_tools,
        )

        assert updated is not None
        assert updated["permission_mode"] == 1
        assert updated["permission_required_tools"] == json.dumps(perm_tools)

    async def test_to_info_complete(self, session_manager):
        """Test to_info converts dict to SessionInfo with all fields."""
        work_dir = tempfile.gettempdir()
        perm_tools = ["Bash"]
        created = await session_manager.create(
            work_dir=work_dir,
            allowed_tools="Read,Write",
            system_prompt="Test",
            timeout_seconds=60,
            permission_mode=True,
            permission_required_tools=perm_tools,
        )
        session_id = created["id"]

        # Add counts
        timestamp = datetime.now(timezone.utc).isoformat()
        await session_manager.add_message(session_id, "user", "test", timestamp)
        await session_manager.add_file_change(
            session_id, "Write", "/test.txt", timestamp
        )
        await session_manager.update_settings(session_id, name="Test Session")

        session_dict = await session_manager.get_with_counts(session_id)
        info = session_manager.to_info(session_dict)

        assert isinstance(info, SessionInfo)
        assert info.id == session_id
        assert info.work_dir == work_dir
        assert info.status == SessionStatus.IDLE
        assert info.allowed_tools == "Read,Write"
        assert info.system_prompt == "Test"
        assert info.timeout_seconds == 60
        assert info.message_count == 1
        assert info.file_changes_count == 1
        assert info.permission_mode is True
        assert info.permission_required_tools == perm_tools
        assert info.name == "Test Session"

    async def test_to_info_permission_tools_json_parse_failure(self, session_manager):
        """Test to_info handles JSON parse failure for permission_required_tools."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(work_dir=work_dir)
        session_id = created["id"]

        session_dict = await session_manager.get(session_id)
        # Manually corrupt JSON
        session_dict["permission_required_tools"] = "invalid-json"

        info = session_manager.to_info(session_dict)

        assert info.permission_required_tools is None

    async def test_to_info_permission_mode_int_to_bool(self, session_manager):
        """Test to_info converts permission_mode int to bool."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(
            work_dir=work_dir,
            permission_mode=True,
        )
        session_id = created["id"]

        session_dict = await session_manager.get(session_id)
        # DB stores as int
        assert session_dict["permission_mode"] == 1

        info = session_manager.to_info(session_dict)
        assert info.permission_mode is True

        # Test False case
        await session_manager.update_settings(session_id, permission_mode=False)
        session_dict = await session_manager.get(session_id)
        assert session_dict["permission_mode"] == 0

        info = session_manager.to_info(session_dict)
        assert info.permission_mode is False

    async def test_to_info_dict(self, session_manager):
        """Test to_info_dict converts to dict via SessionInfo."""
        work_dir = tempfile.gettempdir()
        created = await session_manager.create(work_dir=work_dir)
        session_id = created["id"]

        session_dict = await session_manager.get(session_id)
        info_dict = session_manager.to_info_dict(session_dict)

        assert isinstance(info_dict, dict)
        assert info_dict["id"] == session_id
        assert info_dict["work_dir"] == work_dir
        assert info_dict["status"] == SessionStatus.IDLE
        assert info_dict["permission_mode"] is False
