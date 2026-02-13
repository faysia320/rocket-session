"""WebSocket 엔드포인트 - 실시간 스트리밍."""

import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.api.dependencies import (
    get_claude_runner,
    get_session_manager,
    get_settings,
    get_ws_manager,
)
from app.api.v1.endpoints.permissions import respond_permission
from app.services.claude_runner import ClaudeRunner
from app.services.session_manager import SessionManager
from app.services.websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)

router = APIRouter()


def _on_runner_task_done(task: asyncio.Task, session_id: str) -> None:
    """runner task 완료 시 예외 로깅 콜백."""
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
    runner_task: asyncio.Task | None,
) -> asyncio.Task | None:
    """prompt 메시지 처리: 유효성 검사, 메시지 저장, runner task 생성."""
    prompt = data.get("prompt", "")
    if not prompt:
        await ws.send_json({"type": "error", "message": "Empty prompt"})
        return runner_task

    # 이미 실행 중인 runner가 있으면 거부
    if runner_task and not runner_task.done():
        await ws.send_json(
            {"type": "error", "message": "이미 실행 중인 요청이 있습니다"}
        )
        return runner_task

    # 세션 설정에서 allowed_tools 로드 (요청 > 세션 설정 > 전역 설정 우선순위)
    current_session = await manager.get(session_id)
    allowed_tools = (
        data.get("allowed_tools")
        or (current_session.get("allowed_tools") if current_session else None)
        or settings.claude_allowed_tools
    )

    # 모드: 요청 > 세션 DB 설정 > 기본값
    mode = (
        data.get("mode")
        or (current_session.get("mode") if current_session else None)
        or "normal"
    )

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
        session_id, {"type": "user_message", "message": user_msg}
    )

    # ClaudeRunner에 최신 세션 정보 전달
    task = asyncio.create_task(
        runner.run(
            current_session,
            prompt,
            allowed_tools,
            session_id,
            ws_manager,
            manager,
            mode=mode,
        )
    )
    task.add_done_callback(lambda t: _on_runner_task_done(t, session_id))
    return task


async def _handle_stop(
    session_id: str,
    manager: SessionManager,
    ws_manager: WebSocketManager,
    runner_task: asyncio.Task | None,
) -> None:
    """stop 메시지 처리: 프로세스 종료."""
    if runner_task and not runner_task.done():
        runner_task.cancel()
    await manager.kill_process(session_id)
    await ws_manager.broadcast_event(session_id, {"type": "stopped"})


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

    session = await manager.get(session_id)
    if not session:
        await ws.send_json({"type": "error", "message": "Session not found"})
        await ws.close()
        return

    # last_seq 쿼리 파라미터 파싱 (재연결 시)
    last_seq_param = ws.query_params.get("last_seq")
    last_seq = int(last_seq_param) if last_seq_param and last_seq_param.isdigit() else None

    ws_manager.register(session_id, ws)
    runner_task: asyncio.Task | None = None

    try:
        session_with_counts = await manager.get_with_counts(session_id) or session
        latest_seq = ws_manager.get_latest_seq(session_id)

        if last_seq is not None:
            # 재연결: 세션 상태만 전송 (히스토리 없음) + 놓친 이벤트 전송
            await ws.send_json(
                {
                    "type": "session_state",
                    "session": manager.to_info_dict(session_with_counts),
                    "latest_seq": latest_seq,
                    "is_reconnect": True,
                }
            )
            # 놓친 이벤트 조회 및 전송
            missed = await ws_manager.get_buffered_events_after(session_id, last_seq)
            if missed:
                await ws.send_json(
                    {
                        "type": "missed_events",
                        "events": missed,
                        "latest_seq": latest_seq,
                    }
                )
        else:
            # 최초 연결: 기존 로직 + latest_seq 필드 추가
            history = await manager.get_history(session_id)
            await ws.send_json(
                {
                    "type": "session_state",
                    "session": manager.to_info_dict(session_with_counts),
                    "history": history,
                    "latest_seq": latest_seq,
                }
            )

        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")

            if msg_type == "prompt":
                runner_task = await _handle_prompt(
                    data,
                    session_id,
                    manager,
                    ws_manager,
                    ws,
                    settings,
                    runner,
                    runner_task,
                )

            elif msg_type == "stop":
                await _handle_stop(session_id, manager, ws_manager, runner_task)

            elif msg_type == "permission_respond":
                await _handle_permission_respond(data)

            elif msg_type == "ping":
                await ws.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    finally:
        if runner_task and not runner_task.done():
            runner_task.cancel()
        ws_manager.unregister(session_id, ws)
