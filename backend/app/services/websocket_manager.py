"""WebSocket 연결 레지스트리 및 브로드캐스트 관리."""

from __future__ import annotations

import json
import logging
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from fastapi import WebSocket
from starlette.websockets import WebSocketState

if TYPE_CHECKING:
    from app.core.database import Database

logger = logging.getLogger(__name__)

MAX_BUFFER_SIZE = 1000


@dataclass
class BufferedEvent:
    seq: int
    event_type: str
    payload: dict
    timestamp: str


class WebSocketManager:
    """세션별 WebSocket 연결 관리, 이벤트 버퍼링 및 메시지 브로드캐스트."""

    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}
        self._event_buffers: dict[str, deque[BufferedEvent]] = {}
        self._seq_counters: dict[str, int] = {}
        self._db: Database | None = None

    def set_database(self, db: Database):
        """DB 참조 설정 (의존성 주입)."""
        self._db = db

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

    def _next_seq(self, session_id: str) -> int:
        """세션별 다음 시퀀스 번호 반환."""
        seq = self._seq_counters.get(session_id, 0) + 1
        self._seq_counters[session_id] = seq
        return seq

    def get_latest_seq(self, session_id: str) -> int:
        """세션의 현재 최신 시퀀스 번호."""
        return self._seq_counters.get(session_id, 0)

    async def broadcast_event(self, session_id: str, message: dict) -> int:
        """이벤트에 seq 부여 + 버퍼 저장 + DB 저장 + broadcast. seq 반환."""
        seq = self._next_seq(session_id)
        event_type = message.get("type", "unknown")
        ts = datetime.now(timezone.utc).isoformat()

        # 메시지에 seq 부여
        message_with_seq = {**message, "seq": seq}

        # 인메모리 버퍼 저장
        if session_id not in self._event_buffers:
            self._event_buffers[session_id] = deque(maxlen=MAX_BUFFER_SIZE)
        self._event_buffers[session_id].append(
            BufferedEvent(seq=seq, event_type=event_type, payload=message_with_seq, timestamp=ts)
        )

        # DB 저장 (비동기, 실패해도 broadcast는 진행)
        if self._db:
            try:
                await self._db.add_event(
                    session_id=session_id,
                    seq=seq,
                    event_type=event_type,
                    payload=json.dumps(message_with_seq, ensure_ascii=False),
                    timestamp=ts,
                )
            except Exception as e:
                logger.warning("이벤트 DB 저장 실패 (세션 %s, seq %d): %s", session_id, seq, e)

        # 연결된 클라이언트에 broadcast
        await self.broadcast(session_id, message_with_seq)
        return seq

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

    async def get_buffered_events_after(self, session_id: str, after_seq: int) -> list[dict]:
        """놓친 이벤트 조회. 인메모리 버퍼 우선, 없으면 DB fallback."""
        buffer = self._event_buffers.get(session_id)

        if buffer:
            # 인메모리 버퍼에서 조회
            first_buffered_seq = buffer[0].seq if buffer else 0
            if after_seq >= first_buffered_seq:
                return [e.payload for e in buffer if e.seq > after_seq]

        # DB fallback
        if self._db:
            try:
                rows = await self._db.get_events_after(session_id, after_seq)
                results = []
                for row in rows:
                    try:
                        results.append(json.loads(row["payload"]))
                    except (json.JSONDecodeError, KeyError):
                        continue
                return results
            except Exception as e:
                logger.warning("이벤트 DB 조회 실패 (세션 %s): %s", session_id, e)

        return []

    def get_current_turn_events(self, session_id: str) -> list[dict]:
        """현재 턴(마지막 user_message 이후)의 이벤트 목록 반환."""
        buffer = self._event_buffers.get(session_id)
        if not buffer:
            return []

        # 버퍼에서 마지막 user_message 이벤트의 seq 찾기
        last_user_seq = 0
        for evt in buffer:
            if evt.event_type == "user_message":
                last_user_seq = evt.seq

        if last_user_seq == 0:
            return []

        # 해당 seq 이후 모든 이벤트 반환 (user_message 자체는 제외)
        return [e.payload for e in buffer if e.seq > last_user_seq]

    def clear_buffer(self, session_id: str):
        """세션의 인메모리 버퍼 정리."""
        self._event_buffers.pop(session_id, None)

    def reset_session(self, session_id: str):
        """세션의 버퍼 + 시퀀스 카운터 초기화."""
        self._event_buffers.pop(session_id, None)
        self._seq_counters.pop(session_id, None)
