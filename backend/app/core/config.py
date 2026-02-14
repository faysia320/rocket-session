"""애플리케이션 환경 설정."""

import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """환경 변수 기반 설정."""

    claude_work_dir: str = os.path.expanduser("~")
    claude_allowed_tools: str = "Read,Write,Edit,Bash"

    backend_host: str = "0.0.0.0"
    backend_port: int = 8101

    cors_origins: list[str] = ["http://localhost:8100", "http://localhost:8101"]
    cors_extra_origins: str = ""

    upload_dir: str = ""

    database_path: str = str(
        Path(__file__).resolve().parent.parent.parent / "data" / "sessions.db"
    )

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }

    @property
    def all_cors_origins(self) -> list[str]:
        """기본 + 추가 CORS origin 목록."""
        origins = list(self.cors_origins)
        if self.cors_extra_origins:
            for origin in self.cors_extra_origins.split(","):
                origin = origin.strip()
                if origin and origin not in origins:
                    origins.append(origin)
        return origins

    @property
    def resolved_upload_dir(self) -> str:
        """업로드 디렉토리. 설정되지 않으면 시스템 임시 디렉토리 사용."""
        if self.upload_dir:
            return self.upload_dir
        import tempfile

        return str(Path(tempfile.gettempdir()) / "rocket-session-uploads")
