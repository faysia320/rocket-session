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

    # Permission
    PERMISSION_REQUEST = "permission_request"
    PERMISSION_RESPONSE = "permission_response"

    # Workflow
    WORKFLOW_STARTED = "workflow_started"
    WORKFLOW_PHASE_COMPLETED = "workflow_phase_completed"
    WORKFLOW_PHASE_APPROVED = "workflow_phase_approved"
    WORKFLOW_PHASE_REVISION = "workflow_phase_revision"
    WORKFLOW_ARTIFACT_UPDATED = "workflow_artifact_updated"
    WORKFLOW_ANNOTATION_ADDED = "workflow_annotation_added"
    WORKFLOW_COMPLETED = "workflow_completed"

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

    # System
    SYSTEM = "system"

    # Team events
    TEAM_TASK_CREATED = "team_task_created"
    TEAM_TASK_UPDATED = "team_task_updated"
    TEAM_TASK_COMPLETED = "team_task_completed"
    TEAM_TASK_DELEGATED = "team_task_delegated"
    TEAM_MEMBER_JOINED = "team_member_joined"
    TEAM_MEMBER_LEFT = "team_member_left"
    TEAM_STATUS_CHANGED = "team_status_changed"
    TEAM_MESSAGE = "team_message"
