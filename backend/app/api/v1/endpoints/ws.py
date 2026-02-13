"""WebSocket 엔드포인트 - 실시간 스트리밍."""

import asyncio
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.api.dependencies import (
    get_claude_runner,
    get_session_manager,
    get_settings,
    get_ws_manager,
)

router = APIRouter()


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

    ws_manager.register(session_id, ws)

    # 세션 정보 + 히스토리를 함께 전송
    sessions = await manager.list_all()
    session_with_counts = session
    for s in sessions:
        if s["id"] == session_id:
            session_with_counts = s
            break

    history = await manager.get_history(session_id)
    await ws.send_json(
        {
            "type": "session_state",
            "session": manager.to_info_dict(session_with_counts),
            "history": history,
        }
    )

    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")

            if msg_type == "prompt":
                prompt = data.get("prompt", "")
                if not prompt:
                    await ws.send_json(
                        {"type": "error", "message": "Empty prompt"}
                    )
                    continue

                # 세션 설정에서 allowed_tools 로드 (요청 > 세션 설정 > 전역 설정 우선순위)
                current_session = await manager.get(session_id)
                allowed_tools = data.get("allowed_tools") or (
                    current_session.get("allowed_tools") if current_session else None
                ) or settings.claude_allowed_tools

                ts = datetime.utcnow().isoformat()
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
                await ws_manager.broadcast(
                    session_id, {"type": "user_message", "message": user_msg}
                )

                # ClaudeRunner에 최신 세션 정보 전달
                asyncio.create_task(
                    runner.run(
                        current_session,
                        prompt,
                        allowed_tools,
                        session_id,
                        ws_manager,
                        manager,
                    )
                )

            elif msg_type == "stop":
                await manager.kill_process(session_id)
                await ws_manager.broadcast(session_id, {"type": "stopped"})

            elif msg_type == "ping":
                await ws.send_json({"type": "pong"})

    except WebSocketDisconnect:
        ws_manager.unregister(session_id, ws)
