"""WebSocket 연결 레지스트리 및 브로드캐스트 관리."""

import logging

from fastapi import WebSocket
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)


class WebSocketManager:
    """세션별 WebSocket 연결 관리 및 메시지 브로드캐스트."""

    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}

    def register(self, session_id: str, ws: WebSocket):
        if session_id not in self._connections:
            self._connections[session_id] = []
        self._connections[session_id].append(ws)

    def unregister(self, session_id: str, ws: WebSocket):
        ws_list = self._connections.get(session_id, [])
        if ws in ws_list:
            ws_list.remove(ws)

    def has_connections(self, session_id: str) -> bool:
        """세션에 활성 연결이 있는지 확인."""
        return bool(self._connections.get(session_id))

    async def broadcast(self, session_id: str, message: dict):
        """세션에 연결된 모든 WebSocket에 메시지 전송."""
        ws_list = self._connections.get(session_id, [])
        if not ws_list:
            return
        dead: list[WebSocket] = []
        for ws in ws_list:
            try:
                if ws.client_state != WebSocketState.CONNECTED:
                    dead.append(ws)
                    continue
                await ws.send_json(message)
            except Exception as e:
                logger.debug("WebSocket 전송 실패 (세션 %s): %s", session_id, e)
                dead.append(ws)
        for ws in dead:
            ws_list.remove(ws)
