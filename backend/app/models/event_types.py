"""Claude CLI / WebSocket event type constants.

CLI stream-json output event types and internal WebSocket event types
are centralized here to eliminate magic strings across the codebase.
"""


class CliEventType:
    """Claude CLI stream-json output event types."""

    SYSTEM = "system"
    ASSISTANT = "assistant"
    USER = "user"
    RESULT = "result"


class WsEventType:
    """WebSocket event types sent to the frontend."""

    # Session state
    SESSION_STATE = "session_state"
    SESSION_INFO = "session_info"
    STATUS = "status"
    STOPPED = "stopped"

    # Messages
    USER_MESSAGE = "user_message"
    ASSISTANT_TEXT = "assistant_text"
    THINKING = "thinking"
    RESULT = "result"

    # Tools
    TOOL_USE = "tool_use"
    TOOL_RESULT = "tool_result"
    FILE_CHANGE = "file_change"

    # Mode / Permission
    MODE_CHANGE = "mode_change"
    PERMISSION_REQUEST = "permission_request"
    PERMISSION_RESPONSE = "permission_response"

    # Interactive
    ASK_USER_QUESTION = "ask_user_question"

    # Error / Debug
    ERROR = "error"
    STDERR = "stderr"
    RAW = "raw"
    EVENT = "event"

    # Reconnection
    MISSED_EVENTS = "missed_events"

    # Heartbeat
    PONG = "pong"
