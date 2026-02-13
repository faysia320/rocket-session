"""애플리케이션 환경 설정."""

import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """환경 변수 기반 설정."""

    claude_work_dir: str = os.path.expanduser("~")
    claude_allowed_tools: str = "Read,Write,Edit,Bash"
    claude_model: str = ""
    claude_plan: str = "Max"

    backend_host: str = "0.0.0.0"
    backend_port: int = 8101

    cors_origins: list[str] = ["*"]

    database_path: str = str(Path(__file__).resolve().parent.parent.parent / "data" / "sessions.db")

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }
