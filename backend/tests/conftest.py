"""Shared test fixtures."""

import asyncio
import logging
import os
import tempfile
from unittest.mock import AsyncMock, MagicMock
from urllib.parse import urlparse

import pytest
import pytest_asyncio
from sqlalchemy import text

# ---------------------------------------------------------------------------
# 테스트 DB URL 결정 + 프로덕션 DB 보호 안전장치
# ---------------------------------------------------------------------------
_TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://rocket:rocket_secret@localhost:5432/rocket_session_test",
)

# 안전장치: DB 이름에 'test' 포함 강제
_db_name = _TEST_DB_URL.rsplit("/", 1)[-1].split("?")[0]
if "test" not in _db_name.lower():
    raise RuntimeError(
        f"테스트 DB URL의 데이터베이스 이름에 'test'가 포함되어야 합니다. "
        f"프로덕션 DB 보호를 위해 중단합니다: {_TEST_DB_URL}"
    )

# 기존 DATABASE_URL을 강제로 덮어씀 (setdefault 취약점 제거)
os.environ["DATABASE_URL"] = _TEST_DB_URL
os.environ["CLAUDE_WORK_DIR"] = tempfile.gettempdir()

from app.core.config import Settings  # noqa: E402
from app.core.database import Database  # noqa: E402
from app.services.filesystem_service import FilesystemService  # noqa: E402
from app.services.session_manager import SessionManager  # noqa: E402
from app.services.usage_service import UsageService  # noqa: E402
from app.services.websocket_manager import WebSocketManager  # noqa: E402

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 테스트 DB 자동 생성 (session scope)
# ---------------------------------------------------------------------------
async def _ensure_test_db_exists():
    """테스트 DB가 없으면 자동 생성."""
    import asyncpg

    parsed = urlparse(_TEST_DB_URL.replace("+asyncpg", ""))
    db_name = parsed.path.lstrip("/")

    try:
        conn = await asyncpg.connect(
            user=parsed.username,
            password=parsed.password,
            host=parsed.hostname,
            port=parsed.port or 5432,
            database="postgres",
        )
        try:
            exists = await conn.fetchval(
                "SELECT 1 FROM pg_database WHERE datname = $1", db_name
            )
            if not exists:
                await conn.execute(f'CREATE DATABASE "{db_name}"')
                logger.info("테스트 DB 생성 완료: %s", db_name)
        finally:
            await conn.close()
    except Exception as e:
        logger.warning("테스트 DB 자동 생성 실패 (수동 생성 필요): %s", e)


@pytest.fixture(scope="session")
def event_loop():
    """Session-scoped event loop."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
def ensure_test_db(event_loop):
    """세션 스코프: 테스트 시작 전 테스트 DB 존재 보장."""
    event_loop.run_until_complete(_ensure_test_db_exists())


# ---------------------------------------------------------------------------
# 핵심 fixtures
# ---------------------------------------------------------------------------
_TRUNCATE_TABLES = [
    "session_tags",
    "events",
    "file_changes",
    "messages",
    "sessions",
    "mcp_servers",
    "tags",
    "session_templates",
    "global_settings",
]


@pytest_asyncio.fixture
async def db():
    """PostgreSQL database fixture. 테스트용 DB 사용 + 데이터 격리."""
    database = Database(_TEST_DB_URL)
    await database.initialize()

    # 테스트 시작 전: 모든 테이블 데이터 정리
    async with database.session() as session:
        for table in _TRUNCATE_TABLES:
            await session.execute(text(f"DELETE FROM {table}"))
        await session.commit()

    # 글로벌 설정 기본 행 재생성 (삭제했으므로)
    async with database.session() as session:
        from app.repositories.settings_repo import SettingsRepository

        repo = SettingsRepository(session)
        await repo.ensure_default_exists()
        await session.commit()

    yield database
    await database.close()


@pytest.fixture
def settings():
    """Test Settings instance."""
    return Settings(
        claude_work_dir=tempfile.gettempdir(),
        claude_allowed_tools="Read,Write",
    )


@pytest_asyncio.fixture
async def session_manager(db):
    """SessionManager fixture with test database."""
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
    from starlette.websockets import WebSocketState

    ws.client_state = WebSocketState.CONNECTED
    ws.send_json = AsyncMock()
    ws.send_text = AsyncMock()
    return ws


@pytest_asyncio.fixture
async def test_session(session_manager):
    """Create a single test session."""
    session = await session_manager.create(
        work_dir=tempfile.gettempdir(),
        allowed_tools="Read,Write",
    )
    return session
