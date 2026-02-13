"""WebSocket 연결 레지스트리 및 브로드캐스트 관리."""

from fastapi import WebSocket


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

    async def broadcast(self, session_id: str, message: dict):
        """세션에 연결된 모든 WebSocket에 메시지 전송."""
        ws_list = self._connections.get(session_id, [])
        dead: list[WebSocket] = []
        for ws in ws_list:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            ws_list.remove(ws)
