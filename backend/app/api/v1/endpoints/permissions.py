"""Permission 요청/응답 API - MCP 서버와 프론트엔드 간 중계."""

import asyncio
import logging
import uuid

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.dependencies import get_settings_service, get_ws_manager
from app.models.event_types import WsEventType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/permissions", tags=["permissions"])

# 인메모리 pending 요청 저장소
MAX_PENDING = 100
_pending: dict[str, dict] = {}

# 세션별 신뢰 도구 저장소 (인메모리, 서버 재시작 시 초기화)
_session_trusted_tools: dict[str, set[str]] = {}


class PermissionRequest(BaseModel):
    tool_name: str
    tool_input: dict = {}


class PermissionResponse(BaseModel):
    behavior: str  # "allow" or "deny"


def get_pending() -> dict[str, dict]:
    """pending 딕셔너리 접근 (ws.py에서도 사용)."""
    return _pending


def clear_pending():
    """서버 종료 시 모든 pending 요청 정리."""
    for entry in _pending.values():
        entry["response"] = {"behavior": "deny"}
        entry["event"].set()
    _pending.clear()


def clear_session_trusted(session_id: str):
    """세션 삭제 시 해당 세션의 신뢰 도구 정리."""
    _session_trusted_tools.pop(session_id, None)


@router.post("/{session_id}/request")
async def request_permission(session_id: str, body: PermissionRequest):
    """MCP 서버가 호출 - 사용자에게 권한 요청을 전달하고 응답 대기."""

    # 1. 세션 레벨 신뢰 확인
    session_trusted = _session_trusted_tools.get(session_id, set())
    if body.tool_name in session_trusted:
        logger.info(
            "Permission 자동 승인 (세션 신뢰): tool=%s, session=%s",
            body.tool_name,
            session_id,
        )
        return {"behavior": "allow"}

    # 2. 글로벌 레벨 신뢰 확인
    try:
        settings_service = get_settings_service()
        global_settings = await settings_service.get()
        globally_trusted = global_settings.get("globally_trusted_tools") or []
        if body.tool_name in globally_trusted:
            logger.info(
                "Permission 자동 승인 (글로벌 신뢰): tool=%s", body.tool_name
            )
            return {"behavior": "allow"}
    except Exception:
        logger.warning("글로벌 신뢰 도구 확인 실패, 수동 승인으로 진행", exc_info=True)

    # 3. 기존 흐름: 프론트엔드에 요청 전송 후 응답 대기
    if len(_pending) >= MAX_PENDING:
        logger.warning("Pending 요청 수 초과 (%d), 가장 오래된 요청 정리", MAX_PENDING)
        oldest_id = next(iter(_pending))
        oldest = _pending.pop(oldest_id)
        oldest["response"] = {"behavior": "deny"}
        oldest["event"].set()

    permission_id = str(uuid.uuid4())[:12]
    event = asyncio.Event()

    pending_entry = {
        "event": event,
        "permission_id": permission_id,
        "session_id": session_id,
        "tool_name": body.tool_name,
        "tool_input": body.tool_input,
        "response": None,
    }
    _pending[permission_id] = pending_entry

    # WebSocket으로 프론트엔드에 permission 요청 브로드캐스트
    ws_manager = get_ws_manager()
    await ws_manager.broadcast_event(
        session_id,
        {
            "type": WsEventType.PERMISSION_REQUEST,
            "permission_id": permission_id,
            "tool_name": body.tool_name,
            "tool_input": body.tool_input,
        },
    )

    try:
        # 프론트엔드 응답 대기 (최대 120초)
        await asyncio.wait_for(event.wait(), timeout=120)
        response = pending_entry.get("response", {"behavior": "deny"})
        return response
    except asyncio.TimeoutError:
        logger.warning(
            "Permission 요청 타임아웃: %s (세션: %s)", permission_id, session_id
        )
        # 타임아웃 시 프론트엔드에 알림
        await ws_manager.broadcast_event(
            session_id,
            {
                "type": WsEventType.PERMISSION_RESPONSE,
                "permission_id": permission_id,
                "behavior": "deny",
                "reason": "timeout",
            },
        )
        return {"behavior": "deny"}
    finally:
        _pending.pop(permission_id, None)


async def respond_permission(
    permission_id: str, behavior: str, trust_level: str = "once"
) -> bool:
    """permission 응답 처리 (ws.py에서 호출).

    trust_level:
    - "once": 이번만 허용 (기본값)
    - "session": 세션 동안 같은 도구 자동 승인
    - "always": 모든 세션에서 해당 도구 자동 승인 (DB 저장)
    """
    entry = _pending.get(permission_id)
    if not entry:
        return False

    entry["response"] = {"behavior": behavior}
    entry["event"].set()

    # Trust level 처리: allow인 경우에만 신뢰 등록
    if behavior == "allow" and trust_level != "once":
        tool_name = entry.get("tool_name", "")
        session_id = entry.get("session_id", "")

        if trust_level == "session" and tool_name and session_id:
            _session_trusted_tools.setdefault(session_id, set()).add(tool_name)
            logger.info(
                "도구 세션 신뢰 등록: %s (세션: %s)", tool_name, session_id
            )

        elif trust_level == "always" and tool_name:
            # 세션 신뢰에도 즉시 등록
            if session_id:
                _session_trusted_tools.setdefault(session_id, set()).add(
                    tool_name
                )
            # DB에 글로벌 신뢰 저장
            try:
                settings_service = get_settings_service()
                current = await settings_service.get()
                existing = current.get("globally_trusted_tools") or []
                trusted = list(set(existing + [tool_name]))
                await settings_service.update(globally_trusted_tools=trusted)
                logger.info("도구 글로벌 신뢰 등록: %s", tool_name)
            except Exception:
                logger.warning(
                    "글로벌 신뢰 저장 실패: %s", tool_name, exc_info=True
                )

    # 프론트엔드에 응답 확인 브로드캐스트
    ws_manager = get_ws_manager()
    await ws_manager.broadcast_event(
        entry["session_id"],
        {
            "type": WsEventType.PERMISSION_RESPONSE,
            "permission_id": permission_id,
            "behavior": behavior,
            "trust_level": trust_level,
        },
    )
    return True
