"""세션 도메인 모델."""

import asyncio
from datetime import datetime
from enum import Enum
from typing import Optional


class SessionStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    ERROR = "error"


class Session:
    """Claude Code CLI 세션을 나타내는 인메모리 모델."""

    def __init__(self, session_id: str, work_dir: str):
        self.id = session_id
        self.claude_session_id: Optional[str] = None
        self.work_dir = work_dir
        self.status: SessionStatus = SessionStatus.IDLE
        self.history: list[dict] = []
        self.process: Optional[asyncio.subprocess.Process] = None
        self.created_at: str = datetime.utcnow().isoformat()
        self.file_changes: list[dict] = []
