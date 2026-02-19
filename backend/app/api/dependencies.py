"""FastAPI 의존성 주입 프로바이더."""

import logging
from functools import lru_cache
from pathlib import Path

from app.core.config import Settings
from app.core.database import Database
from app.services.claude_runner import ClaudeRunner
from app.services.filesystem_service import FilesystemService
from app.services.jsonl_watcher import JsonlWatcher
from app.services.local_session_scanner import LocalSessionScanner
from app.services.mcp_service import McpService
from app.services.session_manager import SessionManager
from app.services.settings_service import SettingsService
from app.services.usage_service import UsageService
from app.services.websocket_manager import WebSocketManager

# 싱글턴 인스턴스 (앱 시작 시 초기화)
_database: Database | None = None
_session_manager: SessionManager | None = None
_local_scanner: LocalSessionScanner | None = None
_usage_service: UsageService | None = None
_ws_manager: WebSocketManager | None = None
_filesystem_service: FilesystemService | None = None
_claude_runner: ClaudeRunner | None = None
_settings_service: SettingsService | None = None
_jsonl_watcher: JsonlWatcher | None = None
_mcp_service: McpService | None = None


@lru_cache(maxsize=1)
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
    if _ws_manager is None:
        raise RuntimeError("WebSocketManager가 초기화되지 않았습니다")
    return _ws_manager


def get_claude_runner() -> ClaudeRunner:
    if _claude_runner is None:
        raise RuntimeError("ClaudeRunner가 초기화되지 않았습니다")
    return _claude_runner


def get_filesystem_service() -> FilesystemService:
    if _filesystem_service is None:
        raise RuntimeError("FilesystemService가 초기화되지 않았습니다")
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


def get_mcp_service() -> McpService:
    if _mcp_service is None:
        raise RuntimeError("McpService가 초기화되지 않았습니다")
    return _mcp_service


async def init_dependencies():
    """앱 시작 시 DB 및 SessionManager 초기화."""
    global \
        _database, \
        _session_manager, \
        _local_scanner, \
        _usage_service, \
        _settings_service, \
        _jsonl_watcher, \
        _filesystem_service, \
        _ws_manager, \
        _claude_runner, \
        _mcp_service
    logger = logging.getLogger(__name__)
    settings = get_settings()
    _filesystem_service = FilesystemService(root_dir=settings.claude_work_dir)

    # 업로드 디렉토리 보장
    upload_path = Path(settings.resolved_upload_dir)
    upload_path.mkdir(parents=True, exist_ok=True)
    logger.info("업로드 디렉토리: %s", upload_path)

    # WebSocketManager를 DB 초기화 전에 인스턴스 생성
    _ws_manager = WebSocketManager()
    _database = Database(settings.database_path)
    await _database.initialize()
    _ws_manager.set_database(_database)
    _session_manager = SessionManager(
        _database, upload_dir=settings.resolved_upload_dir
    )
    _local_scanner = LocalSessionScanner(_database)
    _usage_service = UsageService()
    _claude_runner = ClaudeRunner(settings)
    _settings_service = SettingsService(_database)
    _mcp_service = McpService(_database)
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
    """앱 종료 시 활성 세션 정리 및 DB 연결 종료."""
    global \
        _database, \
        _session_manager, \
        _local_scanner, \
        _usage_service, \
        _claude_runner, \
        _settings_service, \
        _jsonl_watcher, \
        _filesystem_service, \
        _ws_manager, \
        _mcp_service
    logger = logging.getLogger(__name__)
    # 1. 실행 중인 세션 프로세스 종료
    if _session_manager:
        for session_id in list(_session_manager._processes.keys()):
            try:
                await _session_manager.kill_process(session_id)
            except Exception as e:
                logger.error("세션 %s 프로세스 종료 실패: %s", session_id, e)
    # 2. JSONL Watcher 종료
    if _jsonl_watcher:
        try:
            _jsonl_watcher.stop_all()
        except Exception as e:
            logger.error("JsonlWatcher 종료 실패: %s", e)
    # 3. Usage HTTP 클라이언트 정리
    if _usage_service and hasattr(_usage_service, "close"):
        try:
            await _usage_service.close()
        except Exception as e:
            logger.error("UsageService 종료 실패: %s", e)
    # 4. DB 연결 종료
    if _database:
        await _database.close()
    _database = None
    _session_manager = None
    _local_scanner = None
    _usage_service = None
    _claude_runner = None
    _settings_service = None
    _jsonl_watcher = None
    _filesystem_service = None
    _ws_manager = None
    _mcp_service = None
