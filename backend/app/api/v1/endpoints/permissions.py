"""Permission 요청/응답 API - MCP 서버와 프론트엔드 간 중계."""

import asyncio
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.dependencies import get_ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/permissions", tags=["permissions"])

# 인메모리 pending 요청 저장소
_pending: dict[str, dict] = {}


class PermissionRequest(BaseModel):
    tool_name: str
    tool_input: dict = {}


class PermissionResponse(BaseModel):
    behavior: str  # "allow" or "deny"


def get_pending() -> dict[str, dict]:
    """pending 딕셔너리 접근 (ws.py에서도 사용)."""
    return _pending


@router.post("/{session_id}/request")
async def request_permission(session_id: str, body: PermissionRequest):
    """MCP 서버가 호출 - 사용자에게 권한 요청을 전달하고 응답 대기."""
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
    await ws_manager.broadcast(session_id, {
        "type": "permission_request",
        "permission_id": permission_id,
        "tool_name": body.tool_name,
        "tool_input": body.tool_input,
    })

    try:
        # 프론트엔드 응답 대기 (최대 120초)
        await asyncio.wait_for(event.wait(), timeout=120)
        response = pending_entry.get("response", {"behavior": "deny"})
        return response
    except asyncio.TimeoutError:
        logger.warning("Permission 요청 타임아웃: %s (세션: %s)", permission_id, session_id)
        # 타임아웃 시 프론트엔드에 알림
        await ws_manager.broadcast(session_id, {
            "type": "permission_response",
            "permission_id": permission_id,
            "behavior": "deny",
            "reason": "timeout",
        })
        return {"behavior": "deny"}
    finally:
        _pending.pop(permission_id, None)


async def respond_permission(permission_id: str, behavior: str) -> bool:
    """permission 응답 처리 (ws.py에서 호출)."""
    entry = _pending.get(permission_id)
    if not entry:
        return False

    entry["response"] = {"behavior": behavior}
    entry["event"].set()

    # 프론트엔드에 응답 확인 브로드캐스트
    ws_manager = get_ws_manager()
    await ws_manager.broadcast(entry["session_id"], {
        "type": "permission_response",
        "permission_id": permission_id,
        "behavior": behavior,
    })
    return True
