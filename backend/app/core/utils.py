"""공통 유틸리티 함수."""

from datetime import datetime, timezone


def utc_now() -> datetime:
    """현재 UTC 시각을 timezone-aware datetime 객체로 반환 (DB 저장용)."""
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    """현재 UTC 시각을 ISO 형식 문자열로 반환 (WS 이벤트 페이로드용)."""
    return datetime.now(timezone.utc).isoformat()
