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
    WORKFLOW_COMMIT_COMPLETED = "workflow_commit_completed"
    WORKFLOW_AUTO_CHAIN = "workflow_auto_chain"
    WORKFLOW_QA_FAILED = "workflow_qa_failed"
    WORKFLOW_VALIDATION_FAILED = "workflow_validation_failed"
    WORKFLOW_VALIDATION_MAX_RETRIES = "workflow_validation_max_retries"

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

    # Stall / Retry
    STALL_DETECTED = "stall_detected"
    RETRY_ATTEMPT = "retry_attempt"



