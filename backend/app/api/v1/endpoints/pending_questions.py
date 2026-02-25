"""AskUserQuestion pending store - 세션 네비게이션/새로고침 시 복원 지원.

permissions.py의 인메모리 _pending 패턴을 미러링:
- session_id를 키로 하는 인메모리 dict (세션당 최대 1개 질문)
- claude_runner.py에서 AskUserQuestion 감지 시 set
- ws.py에서 사용자 답변 프롬프트 수신 시 clear
- WebSocket 연결 시 pending_interactions에 포함하여 복원
"""

import logging

logger = logging.getLogger(__name__)

# 인메모리 pending question 저장소: {session_id: {questions, tool_use_id, timestamp}}
_pending_questions: dict[str, dict] = {}


def set_pending_question(
    session_id: str,
    questions: list,
    tool_use_id: str,
    timestamp: str,
) -> None:
    """세션에 대기 중인 AskUserQuestion 저장."""
    _pending_questions[session_id] = {
        "session_id": session_id,
        "questions": questions,
        "tool_use_id": tool_use_id,
        "timestamp": timestamp,
    }


def get_pending_question(session_id: str) -> dict | None:
    """세션의 대기 중인 질문 반환. 없으면 None."""
    return _pending_questions.get(session_id)


def clear_pending_question(session_id: str) -> None:
    """사용자 답변 또는 세션 삭제 시 대기 질문 제거."""
    _pending_questions.pop(session_id, None)


def clear_all_pending_questions() -> None:
    """서버 종료 시 모든 대기 질문 정리."""
    _pending_questions.clear()
