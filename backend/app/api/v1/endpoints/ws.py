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

    session = manager.get(session_id)
    if not session:
        await ws.send_json({"type": "error", "message": "Session not found"})
        await ws.close()
        return

    ws_manager.register(session_id, ws)

    await ws.send_json(
        {
            "type": "session_state",
            "session": manager.to_info_dict(session),
            "history": session.history,
        }
    )

    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")

            if msg_type == "prompt":
                prompt = data.get("prompt", "")
                allowed_tools = data.get(
                    "allowed_tools", settings.claude_allowed_tools
                )
                if not prompt:
                    await ws.send_json(
                        {"type": "error", "message": "Empty prompt"}
                    )
                    continue

                user_msg = {
                    "role": "user",
                    "content": prompt,
                    "timestamp": datetime.utcnow().isoformat(),
                }
                session.history.append(user_msg)
                await ws_manager.broadcast(
                    session_id, {"type": "user_message", "message": user_msg}
                )

                asyncio.create_task(
                    runner.run(
                        session, prompt, allowed_tools, session_id, ws_manager
                    )
                )

            elif msg_type == "stop":
                await manager.kill_process(session)
                await ws_manager.broadcast(session_id, {"type": "stopped"})

            elif msg_type == "ping":
                await ws.send_json({"type": "pong"})

    except WebSocketDisconnect:
        ws_manager.unregister(session_id, ws)
