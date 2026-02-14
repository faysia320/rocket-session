"""FastAPI 의존성 주입 프로바이더."""

from functools import lru_cache

from app.core.config import Settings
from app.core.database import Database
from app.services.claude_runner import ClaudeRunner
from app.services.filesystem_service import FilesystemService
from app.services.jsonl_watcher import JsonlWatcher
from app.services.local_session_scanner import LocalSessionScanner
from app.services.session_manager import SessionManager
from app.services.settings_service import SettingsService
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
_settings_service: SettingsService | None = None
_jsonl_watcher: JsonlWatcher | None = None


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


def get_settings_service() -> SettingsService:
    if _settings_service is None:
        raise RuntimeError("SettingsService가 초기화되지 않았습니다")
    return _settings_service


def get_jsonl_watcher() -> JsonlWatcher:
    if _jsonl_watcher is None:
        raise RuntimeError("JsonlWatcher가 초기화되지 않았습니다")
    return _jsonl_watcher


async def init_dependencies():
    """앱 시작 시 DB 및 SessionManager 초기화."""
    global _database, _session_manager, _local_scanner, _usage_service, _settings_service, _jsonl_watcher
    settings = get_settings()
    _database = Database(settings.database_path)
    await _database.initialize()
    _ws_manager.set_database(_database)
    _session_manager = SessionManager(_database)
    _local_scanner = LocalSessionScanner(_database)
    _usage_service = UsageService(settings)
    _settings_service = SettingsService(_database)
    _jsonl_watcher = JsonlWatcher(_session_manager, _ws_manager)

    # 서버 재시작 시 프로세스/task가 없는 stale running 세션을 idle로 복구
    await _database.conn.execute(
        "UPDATE sessions SET status = 'idle' WHERE status = 'running'"
    )
    await _database.conn.commit()

    # seq 카운터를 DB에서 복원 (재시작 후에도 seq 이어서 사용)
    await _ws_manager.restore_seq_counters(_database)

    # 오래된 이벤트 정리 (24시간 이전)
    await _database.cleanup_old_events(max_age_hours=24)


async def shutdown_dependencies():
    """앱 종료 시 DB 연결 정리."""
    global _database, _session_manager, _local_scanner, _usage_service, _claude_runner, _settings_service, _jsonl_watcher
    if _jsonl_watcher:
        _jsonl_watcher.stop_all()
    if _database:
        await _database.close()
    _database = None
    _session_manager = None
    _local_scanner = None
    _usage_service = None
    _claude_runner = None
    _settings_service = None
    _jsonl_watcher = None
