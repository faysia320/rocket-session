"""Shared test fixtures."""

import asyncio
import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Set test environment variables before imports
os.environ["DATABASE_PATH"] = ":memory:"
os.environ["CLAUDE_WORK_DIR"] = tempfile.gettempdir()

from app.core.config import Settings
from app.core.database import Database
from app.services.session_manager import SessionManager
from app.services.usage_service import UsageService
from app.services.websocket_manager import WebSocketManager
from app.services.filesystem_service import FilesystemService


@pytest.fixture(scope="session")
def event_loop():
    """Session-scoped event loop."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def settings():
    """Test Settings instance."""
    return Settings(
        claude_work_dir=tempfile.gettempdir(),
        claude_allowed_tools="Read,Write",
        database_path=":memory:",
    )


@pytest_asyncio.fixture
async def db():
    """In-memory SQLite database fixture."""
    database = Database(":memory:")
    await database.initialize()
    yield database
    await database.close()


@pytest_asyncio.fixture
async def session_manager(db):
    """SessionManager fixture with in-memory database."""
    return SessionManager(db)


@pytest.fixture
def ws_manager():
    """WebSocketManager fixture."""
    return WebSocketManager()


@pytest.fixture
def ws_manager_with_db(db, ws_manager):
    """WebSocketManager fixture with database connection."""
    ws_manager.set_database(db)
    return ws_manager


@pytest.fixture
def filesystem_service():
    """FilesystemService fixture."""
    return FilesystemService()


@pytest.fixture
def usage_service():
    """UsageService fixture."""
    return UsageService()


@pytest.fixture
def mock_websocket():
    """Mock WebSocket fixture."""
    ws = AsyncMock()
    ws.client_state = MagicMock()
    ws.client_state.name = "CONNECTED"
    # Set client_state directly for comparison with WebSocketState.CONNECTED
    from starlette.websockets import WebSocketState
    ws.client_state = WebSocketState.CONNECTED
    ws.send_json = AsyncMock()
    return ws


@pytest_asyncio.fixture
async def test_session(session_manager):
    """Create a single test session."""
    session = await session_manager.create(
        work_dir=tempfile.gettempdir(),
        allowed_tools="Read,Write",
    )
    return session
