"""WebSocket 엔드포인트 - 실시간 스트리밍."""

import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.api.dependencies import (
    get_claude_runner,
    get_jsonl_watcher,
    get_session_manager,
    get_settings,
    get_settings_service,
    get_ws_manager,
)
from app.api.v1.endpoints.permissions import respond_permission
from app.models.event_types import WsEventType
from app.services.claude_runner import ClaudeRunner
from app.services.session_manager import SessionManager
from app.services.websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)

router = APIRouter()


def _on_runner_task_done(
    task: asyncio.Task, session_id: str, manager: SessionManager
) -> None:
    """runner task 완료 시 예외 로깅 + runner_task 참조 정리 콜백."""
    manager.clear_runner_task(session_id)
    if task.cancelled():
        return
    exc = task.exception()
    if exc:
        logger.error("Runner task 비정상 종료 (세션 %s): %s", session_id, exc)


async def _handle_prompt(
    data: dict,
    session_id: str,
    manager: SessionManager,
    ws_manager: WebSocketManager,
    ws: WebSocket,
    settings,
    runner: ClaudeRunner,
) -> None:
    """prompt 메시지 처리: 유효성 검사, 메시지 저장, runner task 생성."""
    prompt = data.get("prompt", "")
    if not prompt:
        await ws.send_json({"type": WsEventType.ERROR, "message": "Empty prompt"})
        return

    # 이미 실행 중인 runner가 있으면 거부
    existing_task = manager.get_runner_task(session_id)
    if existing_task:
        await ws.send_json(
            {"type": WsEventType.ERROR, "message": "이미 실행 중인 요청이 있습니다"}
        )
        return

    # 세션 정보 로드
    current_session = await manager.get(session_id)

    # 글로벌 기본 설정 로드
    settings_service = get_settings_service()
    global_settings = await settings_service.get()

    # allowed_tools: 요청 > 세션 > 글로벌 > env
    allowed_tools = (
        data.get("allowed_tools")
        or (current_session.get("allowed_tools") if current_session else None)
        or global_settings.get("allowed_tools")
        or settings.claude_allowed_tools
    )

    # 모드: 요청 > 세션 > 글로벌 > 기본값
    mode = (
        data.get("mode")
        or (current_session.get("mode") if current_session else None)
        or global_settings.get("mode")
        or "normal"
    )

    # 이미지 경로 목록 (업로드 API로 먼저 업로드한 파일 경로)
    images = data.get("images", [])

    # 세션에 이름이 없으면 첫 프롬프트로 자동 이름 설정
    if current_session and not current_session.get("name"):
        auto_name = prompt[:40].strip()
        if len(prompt) > 40:
            auto_name += "…"
        await manager.update_settings(session_id, name=auto_name)

    ts = datetime.now(timezone.utc).isoformat()
    await manager.add_message(
        session_id=session_id,
        role="user",
        content=prompt,
        timestamp=ts,
    )
    user_msg = {
        "role": "user",
        "content": prompt,
        "timestamp": ts,
    }
    await ws_manager.broadcast_event(
        session_id, {"type": WsEventType.USER_MESSAGE, "message": user_msg}
    )

    # 글로벌 기본값으로 세션 설정 병합 (세션에 값이 없는 필드만)
    merged_session = dict(current_session) if current_session else {}
    for key in [
        "system_prompt",
        "timeout_seconds",
        "permission_mode",
        "permission_required_tools",
        "model",
        "max_turns",
        "max_budget_usd",
        "system_prompt_mode",
        "disallowed_tools",
    ]:
        if not merged_session.get(key) and global_settings.get(key):
            if key == "permission_required_tools":
                val = global_settings[key]
                merged_session[key] = json.dumps(val) if isinstance(val, list) else val
            elif key == "permission_mode":
                merged_session[key] = int(global_settings[key])
            else:
                merged_session[key] = global_settings[key]

    # ClaudeRunner에 최신 세션 정보 전달
    task = asyncio.create_task(
        runner.run(
            merged_session,
            prompt,
            allowed_tools,
            session_id,
            ws_manager,
            manager,
            mode=mode,
            images=images,
        )
    )
    task.add_done_callback(lambda t: _on_runner_task_done(t, session_id, manager))
    manager.set_runner_task(session_id, task)


async def _handle_stop(
    session_id: str,
    manager: SessionManager,
    ws_manager: WebSocketManager,
) -> None:
    """stop 메시지 처리: 프로세스 종료 (kill_process가 runner_task도 취소)."""
    await manager.kill_process(session_id)
    await ws_manager.broadcast_event(session_id, {"type": WsEventType.STOPPED})


async def _handle_permission_respond(data: dict) -> None:
    """permission_respond 메시지 처리."""
    perm_id = data.get("permission_id", "")
    behavior = data.get("behavior", "deny")
    if perm_id:
        await respond_permission(perm_id, behavior)


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(ws: WebSocket, session_id: str):
    await ws.accept()

    manager = get_session_manager()
    ws_manager = get_ws_manager()
    settings = get_settings()
    runner = get_claude_runner()
    jsonl_watcher = get_jsonl_watcher()

    session = await manager.get(session_id)
    if not session:
        await ws.send_json({"type": WsEventType.ERROR, "message": "Session not found"})
        await ws.close()
        return

    # last_seq 쿼리 파라미터 파싱 (재연결 시)
    last_seq_param = ws.query_params.get("last_seq")
    last_seq = (
        int(last_seq_param) if last_seq_param and last_seq_param.isdigit() else None
    )

    ws_manager.register(session_id, ws)

    # JSONL 감시 자동 시작 (import된 세션 + 활성 JSONL 파일)
    await jsonl_watcher.try_auto_start(session_id)

    try:
        session_with_counts = await manager.get_with_counts(session_id) or session
        latest_seq = ws_manager.get_latest_seq(session_id)
        is_running = manager.get_runner_task(
            session_id
        ) is not None or jsonl_watcher.is_watching(session_id)

        if last_seq is not None:
            # 재연결: 세션 상태만 전송 (히스토리 없음) + 놓친 이벤트 전송
            await ws.send_json(
                {
                    "type": WsEventType.SESSION_STATE,
                    "session": manager.to_info_dict(session_with_counts),
                    "latest_seq": latest_seq,
                    "is_reconnect": True,
                    "is_running": is_running,
                }
            )
            # 놓친 이벤트 조회 및 전송
            missed = await ws_manager.get_buffered_events_after(session_id, last_seq)
            if missed:
                await ws.send_json(
                    {
                        "type": WsEventType.MISSED_EVENTS,
                        "events": missed,
                        "latest_seq": latest_seq,
                    }
                )
        else:
            # 최초 연결: 기존 로직 + latest_seq 필드 추가
            history = await manager.get_history(session_id)
            state_msg: dict = {
                "type": WsEventType.SESSION_STATE,
                "session": manager.to_info_dict(session_with_counts),
                "history": history,
                "latest_seq": latest_seq,
                "is_running": is_running,
            }
            # running 세션인 경우 현재 턴 이벤트도 전송
            if is_running:
                current_turn = ws_manager.get_current_turn_events(session_id)
                if current_turn:
                    state_msg["current_turn_events"] = current_turn
            await ws.send_json(state_msg)

        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")

            if msg_type == "prompt":
                await _handle_prompt(
                    data,
                    session_id,
                    manager,
                    ws_manager,
                    ws,
                    settings,
                    runner,
                )

            elif msg_type == "stop":
                await _handle_stop(session_id, manager, ws_manager)

            elif msg_type == "permission_respond":
                await _handle_permission_respond(data)

            elif msg_type == "ping":
                await ws.send_json({"type": WsEventType.PONG})

    except WebSocketDisconnect:
        pass
    finally:
        # runner_task는 취소하지 않음 - Claude 프로세스와 함께 살아있어야 함
        ws_manager.unregister(session_id, ws)
