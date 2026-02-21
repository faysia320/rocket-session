"""
Integration tests for REST API endpoints.

Tests all REST API endpoints with real FastAPI app and PostgreSQL test database.
Uses httpx.AsyncClient for async requests and overrides dependencies for testing.
"""

import tempfile
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.api import dependencies as deps
from app.core.config import Settings
from app.core.database import Database
from app.main import app
from app.services.claude_runner import ClaudeRunner
from app.services.mcp_service import McpService
from app.services.session_manager import SessionManager
from app.services.settings_service import SettingsService
from app.services.template_service import TemplateService
from app.services.websocket_manager import WebSocketManager
from tests.conftest import _TEST_DB_URL


@pytest_asyncio.fixture
async def test_client():
    """
    Create httpx AsyncClient with PostgreSQL test database.

    conftest.py의 _TEST_DB_URL을 사용하여 프로덕션 DB 접근을 원천 차단합니다.
    """
    db = Database(_TEST_DB_URL)
    await db.initialize()

    # 테스트 격리: 이전 실행에서 남은 데이터 정리
    async with db.session() as session:
        await session.execute(text("DELETE FROM session_tags"))
        await session.execute(text("DELETE FROM events"))
        await session.execute(text("DELETE FROM file_changes"))
        await session.execute(text("DELETE FROM messages"))
        await session.execute(text("DELETE FROM sessions"))
        await session.commit()

    # Create test services
    test_settings = Settings(
        claude_work_dir=tempfile.gettempdir(),
    )
    sm = SessionManager(db)
    wm = WebSocketManager()
    wm.set_database(db)
    cr = ClaudeRunner(test_settings)
    ss = SettingsService(db)
    ms = McpService(db)
    ts = TemplateService(db)

    # Override dependencies
    app.dependency_overrides[deps.get_database] = lambda: db
    app.dependency_overrides[deps.get_session_manager] = lambda: sm
    app.dependency_overrides[deps.get_ws_manager] = lambda: wm
    app.dependency_overrides[deps.get_claude_runner] = lambda: cr
    app.dependency_overrides[deps.get_settings] = lambda: test_settings
    app.dependency_overrides[deps.get_settings_service] = lambda: ss
    app.dependency_overrides[deps.get_mcp_service] = lambda: ms
    app.dependency_overrides[deps.get_template_service] = lambda: ts

    # Create client
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    # Cleanup
    app.dependency_overrides.clear()
    await db.close()


# Helper function
async def create_test_session(client: AsyncClient, work_dir: str | None = None) -> dict:
    """Helper function to create a test session."""
    payload = {}
    if work_dir:
        payload["work_dir"] = work_dir

    response = await client.post("/api/sessions/", json=payload)
    assert response.status_code == 200
    return response.json()


@pytest.mark.asyncio
class TestHealthEndpoint:
    """Tests for health check endpoint."""

    async def test_health_check(self, test_client: AsyncClient):
        """Health endpoint should return 200 with status and timestamp."""
        response = await test_client.get("/api/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "timestamp" in data
        # Verify timestamp is valid ISO format
        datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))


@pytest.mark.asyncio
class TestSessionCRUD:
    """Tests for session CRUD operations."""

    async def test_create_session_with_work_dir(self, test_client: AsyncClient):
        """Should create session with provided work_dir."""
        work_dir = "/test/path"
        response = await test_client.post("/api/sessions/", json={"work_dir": work_dir})

        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["work_dir"] == work_dir
        assert data["status"] == "idle"
        assert data["mode"] == "normal"
        assert data["permission_mode"] is False

    async def test_create_session_without_work_dir(self, test_client: AsyncClient):
        """Should create session with default work_dir from settings."""
        response = await test_client.post("/api/sessions/", json={})

        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["work_dir"] == tempfile.gettempdir()
        assert data["status"] == "idle"

    async def test_list_sessions_empty(self, test_client: AsyncClient):
        """Should return empty list when no sessions exist."""
        response = await test_client.get("/api/sessions/")

        assert response.status_code == 200
        data = response.json()
        assert data == []

    async def test_list_sessions_with_data(self, test_client: AsyncClient):
        """Should return list of sessions after creation."""
        # Create two sessions
        await create_test_session(test_client, "/path1")
        await create_test_session(test_client, "/path2")

        response = await test_client.get("/api/sessions/")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert all("id" in s and "work_dir" in s for s in data)

    async def test_get_session_by_id(self, test_client: AsyncClient):
        """Should return session details by ID."""
        created = await create_test_session(test_client, "/test")
        session_id = created["id"]

        response = await test_client.get(f"/api/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == session_id
        assert data["work_dir"] == "/test"

    async def test_get_session_not_found(self, test_client: AsyncClient):
        """Should return 404 for non-existent session."""
        response = await test_client.get("/api/sessions/non-existent-id")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    async def test_update_session(self, test_client: AsyncClient):
        """Should update session fields."""
        created = await create_test_session(test_client)
        session_id = created["id"]

        update_data = {
            "name": "테스트 세션",
            "allowed_tools": "Read,Write",
            "system_prompt": "You are a helpful assistant.",
            "timeout_seconds": 600,
        }
        response = await test_client.patch(
            f"/api/sessions/{session_id}", json=update_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "테스트 세션"
        assert data["allowed_tools"] == "Read,Write"
        assert data["system_prompt"] == "You are a helpful assistant."
        assert data["timeout_seconds"] == 600

    async def test_update_session_not_found(self, test_client: AsyncClient):
        """Should return 404 when updating non-existent session."""
        response = await test_client.patch(
            "/api/sessions/non-existent-id", json={"name": "test"}
        )

        assert response.status_code == 404

    async def test_delete_session(self, test_client: AsyncClient):
        """Should delete session by ID."""
        created = await create_test_session(test_client)
        session_id = created["id"]

        response = await test_client.delete(f"/api/sessions/{session_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "deleted"

        # Verify session is deleted
        get_response = await test_client.get(f"/api/sessions/{session_id}")
        assert get_response.status_code == 404

    async def test_delete_session_not_found(self, test_client: AsyncClient):
        """Should return 404 when deleting non-existent session."""
        response = await test_client.delete("/api/sessions/non-existent-id")

        assert response.status_code == 404


@pytest.mark.asyncio
class TestSessionHistory:
    """Tests for session history endpoints."""

    async def test_get_history_empty(self, test_client: AsyncClient):
        """Should return empty history for new session."""
        created = await create_test_session(test_client)
        session_id = created["id"]

        response = await test_client.get(f"/api/sessions/{session_id}/history")

        assert response.status_code == 200
        data = response.json()
        assert data == []

    async def test_get_history_not_found(self, test_client: AsyncClient):
        """Should return 404 for non-existent session."""
        response = await test_client.get("/api/sessions/non-existent-id/history")

        assert response.status_code == 404


@pytest.mark.asyncio
class TestFileChanges:
    """Tests for file changes endpoints."""

    async def test_get_file_changes_empty(self, test_client: AsyncClient):
        """Should return empty file changes for new session."""
        created = await create_test_session(test_client)
        session_id = created["id"]

        response = await test_client.get(f"/api/sessions/{session_id}/files")

        assert response.status_code == 200
        data = response.json()
        assert data == []

    async def test_get_file_changes_not_found(self, test_client: AsyncClient):
        """Should return 404 for non-existent session."""
        response = await test_client.get("/api/sessions/non-existent-id/files")

        assert response.status_code == 404


@pytest.mark.asyncio
class TestSessionActions:
    """Tests for session action endpoints."""

    async def test_stop_session(self, test_client: AsyncClient):
        """Should stop session (even if not running)."""
        created = await create_test_session(test_client)
        session_id = created["id"]

        response = await test_client.post(f"/api/sessions/{session_id}/stop")

        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        # Status should be stopped after stop action
        assert data["status"] in ["stopped", "idle"]

    async def test_stop_session_not_found(self, test_client: AsyncClient):
        """Should return 404 when stopping non-existent session."""
        response = await test_client.post("/api/sessions/non-existent-id/stop")

        assert response.status_code == 404


@pytest.mark.asyncio
class TestSessionExport:
    """Tests for session export endpoint."""

    async def test_export_session_empty(self, test_client: AsyncClient):
        """Should export session as markdown."""
        created = await create_test_session(test_client)
        session_id = created["id"]

        response = await test_client.get(f"/api/sessions/{session_id}/export")

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/markdown; charset=utf-8"

        # Check markdown content
        content = response.text
        assert f"# {session_id}" in content

    async def test_export_session_not_found(self, test_client: AsyncClient):
        """Should return 404 when exporting non-existent session."""
        response = await test_client.get("/api/sessions/non-existent-id/export")

        assert response.status_code == 404


@pytest.mark.asyncio
class TestSessionModes:
    """Tests for session mode-specific functionality."""

    async def test_create_session_default_mode(self, test_client: AsyncClient):
        """Should create session with default normal mode (mode is set via update)."""
        response = await test_client.post("/api/sessions/", json={"work_dir": "/test"})

        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "normal"

    async def test_create_session_with_permission_mode(self, test_client: AsyncClient):
        """Should create session with permission mode enabled."""
        response = await test_client.post(
            "/api/sessions/",
            json={
                "work_dir": "/test",
                "permission_mode": True,
                "permission_required_tools": ["Write", "Edit", "Bash"],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["permission_mode"] is True
        assert data["permission_required_tools"] == ["Write", "Edit", "Bash"]

    async def test_update_session_mode(self, test_client: AsyncClient):
        """Should update session mode and permission settings."""
        created = await create_test_session(test_client)
        session_id = created["id"]

        response = await test_client.patch(
            f"/api/sessions/{session_id}",
            json={
                "mode": "plan",
                "permission_mode": True,
                "permission_required_tools": ["Bash"],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "plan"
        assert data["permission_mode"] is True
        assert data["permission_required_tools"] == ["Bash"]
