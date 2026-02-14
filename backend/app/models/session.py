"""세션 상태 열거형."""

from enum import Enum


class SessionStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    ERROR = "error"
