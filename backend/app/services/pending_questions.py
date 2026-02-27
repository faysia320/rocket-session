"""AskUserQuestion pending store - 인메모리 캐시 + DB 영속 저장.

세션 네비게이션/새로고침/서버 재시작 시에도 대기 질문이 복원되도록
인메모리 캐시와 DB(sessions.pending_question JSONB)를 동시에 사용합니다.

- claude_runner.py / jsonl_watcher.py에서 AskUserQuestion 감지 시 set
- ws.py에서 사용자 답변 프롬프트 수신 시 clear
- WebSocket 연결 시 pending_interactions에 포함하여 복원
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.database import Database

logger = logging.getLogger(__name__)

# 인메모리 캐시: {session_id: {questions, tool_use_id, timestamp}}
_cache: dict[str, dict] = {}

# DB 인스턴스 (앱 시작 시 init()으로 주입)
_db: Database | None = None


def init(db: Database) -> None:
    """앱 시작 시 DB 인스턴스 주입."""
    global _db
    _db = db


async def set_pending_question(
    session_id: str,
    questions: list,
    tool_use_id: str,
    timestamp: str,
) -> None:
    """세션에 대기 중인 AskUserQuestion 저장 (캐시 + DB)."""
    data = {
        "session_id": session_id,
        "questions": questions,
        "tool_use_id": tool_use_id,
        "timestamp": timestamp,
    }
    _cache[session_id] = data

    if _db is not None:
        try:
            from app.repositories.session_repo import SessionRepository

            async with _db.session() as db_session:
                repo = SessionRepository(db_session)
                await repo.set_pending_question(session_id, data)
                await db_session.commit()
        except Exception:
            logger.exception("pending_question DB 저장 실패 (session=%s)", session_id)


async def get_pending_question(session_id: str) -> dict | None:
    """세션의 대기 중인 질문 반환. 캐시 우선, 캐시 miss 시 DB 폴백."""
    cached = _cache.get(session_id)
    if cached is not None:
        return cached

    if _db is not None:
        try:
            from app.repositories.session_repo import SessionRepository

            async with _db.session() as db_session:
                repo = SessionRepository(db_session)
                data = await repo.get_pending_question(session_id)
                if data is not None:
                    _cache[session_id] = data
                return data
        except Exception:
            logger.exception("pending_question DB 조회 실패 (session=%s)", session_id)

    return None


async def clear_pending_question(session_id: str) -> None:
    """사용자 답변 또는 세션 삭제 시 대기 질문 제거 (캐시 + DB)."""
    _cache.pop(session_id, None)

    if _db is not None:
        try:
            from app.repositories.session_repo import SessionRepository

            async with _db.session() as db_session:
                repo = SessionRepository(db_session)
                await repo.set_pending_question(session_id, None)
                await db_session.commit()
        except Exception:
            logger.exception("pending_question DB 클리어 실패 (session=%s)", session_id)


def clear_all_cache() -> None:
    """서버 종료 시 인메모리 캐시만 정리 (DB는 유지 → 재시작 복구용)."""
    _cache.clear()
