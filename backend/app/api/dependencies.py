"""FastAPI 의존성 주입 프로바이더."""

from functools import lru_cache

from app.core.config import Settings
from app.services.claude_runner import ClaudeRunner
from app.services.session_manager import SessionManager
from app.services.websocket_manager import WebSocketManager

_session_manager = SessionManager()
_ws_manager = WebSocketManager()


@lru_cache()
def get_settings() -> Settings:
    return Settings()


def get_session_manager() -> SessionManager:
    return _session_manager


def get_ws_manager() -> WebSocketManager:
    return _ws_manager


def get_claude_runner() -> ClaudeRunner:
    return ClaudeRunner(get_settings())
