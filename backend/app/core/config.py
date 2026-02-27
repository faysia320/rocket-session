"""애플리케이션 환경 설정."""

from pydantic_settings import BaseSettings

WORKSPACES_ROOT = "/workspaces"


class Settings(BaseSettings):
    """환경 변수 기반 설정."""

    claude_allowed_tools: str = (
        "Read,Write,Edit,MultiEdit,Bash,Glob,Grep,WebFetch,WebSearch,TodoRead,TodoWrite"
    )

    backend_host: str = "0.0.0.0"
    backend_port: int = 8101

    cors_origins: list[str] = ["http://localhost:8100", "http://localhost:8101"]
    cors_extra_origins: str = ""

    upload_dir: str = ""

    database_url: str = (
        "postgresql+asyncpg://rocket:rocket_secret@localhost:5432/rocket_session"
    )

    # DB 연결 풀 설정
    db_pool_size: int = 20
    db_max_overflow: int = 40
    db_pool_timeout: int = 30
    db_pool_recycle: int = 3600

    # 동시성 제한
    max_concurrent_sessions: int = 50

    # 이벤트 큐 설정
    event_queue_maxsize: int = 50000
    event_flush_interval: float = 0.2
    event_batch_max_size: int = 1000

    # 메시지 배치 설정
    message_queue_maxsize: int = 50000
    message_flush_interval: float = 0.3

    # 하트비트 간격 (초)
    ws_heartbeat_interval: int = 15

    # Rate Limiting (aiolimiter)
    # 글로벌: 분당 최대 세션 시작 수
    rate_limit_global_per_minute: float = 60
    # 세션별: 분당 최대 프롬프트 수
    rate_limit_session_per_minute: float = 20

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }

    @property
    def all_cors_origins(self) -> list[str]:
        origins = list(self.cors_origins)
        if self.cors_extra_origins:
            for origin in self.cors_extra_origins.split(","):
                origin = origin.strip()
                if origin and origin not in origins:
                    origins.append(origin)
        return origins

    @property
    def resolved_upload_dir(self) -> str:
        if self.upload_dir:
            return self.upload_dir
        import tempfile
        from pathlib import Path

        return str(Path(tempfile.gettempdir()) / "rocket-session-uploads")

    @property
    def sync_database_url(self) -> str:
        """Alembic 등 동기 실행용 URL (asyncpg -> psycopg2)."""
        return self.database_url.replace(
            "postgresql+asyncpg", "postgresql+psycopg2"
        ).replace("postgresql://", "postgresql+psycopg2://")
