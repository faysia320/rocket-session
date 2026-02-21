"""애플리케이션 환경 설정."""

import os

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """환경 변수 기반 설정."""

    claude_work_dir: str = os.path.expanduser("~")
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
