"""FastAPI 의존성 주입 프로바이더."""

from functools import lru_cache

from app.core.config import Settings
from app.core.database import Database
from app.services.claude_runner import ClaudeRunner
from app.services.filesystem_service import FilesystemService
from app.services.local_session_scanner import LocalSessionScanner
from app.services.session_manager import SessionManager
from app.services.usage_service import UsageService
from app.services.websocket_manager import WebSocketManager

# 싱글턴 인스턴스 (앱 시작 시 초기화)
_database: Database | None = None
_session_manager: SessionManager | None = None
_local_scanner: LocalSessionScanner | None = None
_usage_service: UsageService | None = None
_ws_manager = WebSocketManager()
_filesystem_service = FilesystemService()
_claude_runner: ClaudeRunner | None = None


@lru_cache()
def get_settings() -> Settings:
    return Settings()


def get_database() -> Database:
    if _database is None:
        raise RuntimeError("데이터베이스가 초기화되지 않았습니다")
    return _database


def get_session_manager() -> SessionManager:
    if _session_manager is None:
        raise RuntimeError("SessionManager가 초기화되지 않았습니다")
    return _session_manager


def get_ws_manager() -> WebSocketManager:
    return _ws_manager


def get_claude_runner() -> ClaudeRunner:
    global _claude_runner
    if _claude_runner is None:
        _claude_runner = ClaudeRunner(get_settings())
    return _claude_runner


def get_filesystem_service() -> FilesystemService:
    return _filesystem_service


def get_local_scanner() -> LocalSessionScanner:
    if _local_scanner is None:
        raise RuntimeError("LocalSessionScanner가 초기화되지 않았습니다")
    return _local_scanner


def get_usage_service() -> UsageService:
    if _usage_service is None:
        raise RuntimeError("UsageService가 초기화되지 않았습니다")
    return _usage_service


async def init_dependencies():
    """앱 시작 시 DB 및 SessionManager 초기화."""
    global _database, _session_manager, _local_scanner, _usage_service
    settings = get_settings()
    _database = Database(settings.database_path)
    await _database.initialize()
    _session_manager = SessionManager(_database)
    _local_scanner = LocalSessionScanner(_database)
    _usage_service = UsageService(settings)


async def shutdown_dependencies():
    """앱 종료 시 DB 연결 정리."""
    global _database, _session_manager, _local_scanner, _usage_service, _claude_runner
    if _database:
        await _database.close()
    _database = None
    _session_manager = None
    _local_scanner = None
    _usage_service = None
    _claude_runner = None
