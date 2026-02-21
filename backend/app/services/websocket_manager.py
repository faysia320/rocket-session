"""WebSocket 연결 레지스트리 및 브로드캐스트 관리."""

from __future__ import annotations

import asyncio
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
        self._event_queue: asyncio.Queue[dict] = asyncio.Queue(maxsize=10000)
        self._flush_task: asyncio.Task | None = None
        self._heartbeat_task: asyncio.Task | None = None

    def set_database(self, db: Database):
        """DB 참조 설정 (의존성 주입)."""
        self._db = db

    async def start_background_tasks(self):
        """배치 writer + heartbeat 백그라운드 태스크 시작."""
        self._flush_task = asyncio.create_task(self._batch_writer_loop())
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    async def stop_background_tasks(self):
        """백그라운드 태스크 종료 + 잔여 이벤트 flush."""
        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
        await self._flush_events()

    async def _batch_writer_loop(self):
        """0.5초 간격으로 큐에 쌓인 이벤트를 배치 DB 저장."""
        while True:
            await asyncio.sleep(0.5)
            await self._flush_events()

    async def _flush_events(self):
        """큐의 이벤트를 한번에 배치로 저장."""
        batch: list[dict] = []
        while not self._event_queue.empty():
            try:
                batch.append(self._event_queue.get_nowait())
            except asyncio.QueueEmpty:
                break
        if batch and self._db:
            try:
                from app.repositories.event_repo import EventRepository

                async with self._db.session() as session:
                    repo = EventRepository(session)
                    await repo.add_batch(batch)
                    await session.commit()
            except Exception as e:
                logger.warning("이벤트 배치 DB 저장 실패 (%d건): %s", len(batch), e)

    async def flush_events(self):
        """외부에서 호출 가능한 이벤트 flush."""
        await self._flush_events()

    async def _heartbeat_loop(self):
        """30초 간격 ping으로 dead 연결 감지."""
        ping_payload = json.dumps({"type": "ping"})
        while True:
            await asyncio.sleep(30)
            for session_id, ws_list in list(self._connections.items()):
                if not ws_list:
                    continue

                async def _ping(ws: WebSocket) -> WebSocket | None:
                    try:
                        if ws.client_state != WebSocketState.CONNECTED:
                            return ws
                        await asyncio.wait_for(ws.send_text(ping_payload), timeout=5.0)
                        return None
                    except Exception:
                        return ws

                results = await asyncio.gather(*[_ping(ws) for ws in ws_list])
                dead = [ws for ws in results if ws is not None]
                for ws in dead:
                    if ws in ws_list:
                        ws_list.remove(ws)

    def register(self, session_id: str, ws: WebSocket):
        if session_id not in self._connections:
            self._connections[session_id] = []
        self._connections[session_id].append(ws)

    def unregister(self, session_id: str, ws: WebSocket):
        ws_list = self._connections.get(session_id, [])
        if ws in ws_list:
            ws_list.remove(ws)
        # 빈 리스트 정리
        if not ws_list and session_id in self._connections:
            del self._connections[session_id]

    def has_connections(self, session_id: str) -> bool:
        return bool(self._connections.get(session_id))

    def _next_seq(self, session_id: str) -> int:
        seq = self._seq_counters.get(session_id, 0) + 1
        self._seq_counters[session_id] = seq
        return seq

    def get_latest_seq(self, session_id: str) -> int:
        return self._seq_counters.get(session_id, 0)

    async def broadcast_event(self, session_id: str, message: dict) -> int:
        """이벤트에 seq 부여 + 버퍼 저장 + DB 저장 + broadcast.

        broadcast는 fire-and-forget으로 실행하여 stdout 읽기를 블로킹하지 않음.
        """
        seq = self._next_seq(session_id)
        event_type = message.get("type", "unknown")
        ts = datetime.now(timezone.utc).isoformat()

        message_with_seq = {**message, "seq": seq}

        # 인메모리 버퍼 저장
        if session_id not in self._event_buffers:
            self._event_buffers[session_id] = deque(maxlen=MAX_BUFFER_SIZE)
        self._event_buffers[session_id].append(
            BufferedEvent(
                seq=seq, event_type=event_type, payload=message_with_seq, timestamp=ts
            )
        )

        # DB 저장: 큐에 enqueue (JSONB이므로 dict 그대로 저장)
        if self._db:
            try:
                self._event_queue.put_nowait(
                    {
                        "session_id": session_id,
                        "seq": seq,
                        "event_type": event_type,
                        "payload": message_with_seq,
                        "timestamp": ts,
                    }
                )
            except asyncio.QueueFull:
                logger.warning(
                    "이벤트 큐 가득 참 — 이벤트 드롭 (세션 %s, seq %d)", session_id, seq
                )

        # fire-and-forget: 느린 WS 클라이언트가 stdout 파이프라인을 블로킹하지 않도록
        asyncio.create_task(self.broadcast(session_id, message_with_seq))
        return seq

    async def broadcast(self, session_id: str, message: dict):
        """세션에 연결된 모든 WebSocket에 메시지 병렬 전송."""
        ws_list = self._connections.get(session_id, [])
        if not ws_list:
            return

        payload = json.dumps(message, ensure_ascii=False)

        async def _safe_send(ws: WebSocket) -> WebSocket | None:
            try:
                if ws.client_state != WebSocketState.CONNECTED:
                    return ws
                await asyncio.wait_for(ws.send_text(payload), timeout=3.0)
                return None
            except Exception:
                return ws

        results = await asyncio.gather(*[_safe_send(ws) for ws in ws_list])
        dead = [ws for ws in results if ws is not None]
        for ws in dead:
            if ws in ws_list:
                ws_list.remove(ws)

    async def get_buffered_events_after(
        self, session_id: str, after_seq: int
    ) -> list[dict]:
        """놓친 이벤트 조회. 인메모리 버퍼 우선, 없으면 DB fallback."""
        buffer = self._event_buffers.get(session_id)

        if buffer:
            first_buffered_seq = buffer[0].seq if buffer else 0
            if after_seq >= first_buffered_seq:
                return [e.payload for e in buffer if e.seq > after_seq]

        # DB fallback
        if self._db:
            try:
                from app.repositories.event_repo import EventRepository

                async with self._db.session() as session:
                    repo = EventRepository(session)
                    rows = await repo.get_after(session_id, after_seq)
                    # JSONB payload는 이미 dict
                    return [row["payload"] for row in rows]
            except Exception as e:
                logger.warning("이벤트 DB 조회 실패 (세션 %s): %s", session_id, e)

        return []

    async def get_current_turn_events(self, session_id: str) -> list[dict]:
        """현재 턴(마지막 user_message 이후)의 이벤트 목록 반환."""
        buffer = self._event_buffers.get(session_id)
        if buffer:
            last_user_seq = 0
            for evt in buffer:
                if evt.event_type == "user_message":
                    last_user_seq = evt.seq
            if last_user_seq > 0:
                return [e.payload for e in buffer if e.seq > last_user_seq]

        if self._db:
            try:
                from app.repositories.event_repo import EventRepository

                async with self._db.session() as session:
                    repo = EventRepository(session)
                    rows = await repo.get_current_turn_events(session_id)
                    return [row["payload"] for row in rows]
            except Exception as e:
                logger.warning(
                    "현재 턴 이벤트 DB 조회 실패 (세션 %s): %s", session_id, e
                )

        return []

    def get_current_activity(self, session_id: str) -> dict | None:
        """세션의 현재 활동 요약 반환."""
        buffer = self._event_buffers.get(session_id)
        if not buffer:
            return None

        completed_ids: set[str] = set()
        for evt in buffer:
            if evt.event_type == "tool_result":
                tid = evt.payload.get("tool_use_id")
                if tid:
                    completed_ids.add(tid)

        for evt in reversed(buffer):
            if evt.event_type == "tool_use":
                tid = evt.payload.get("tool_use_id", "")
                if tid not in completed_ids:
                    return {
                        "tool": evt.payload.get("tool", ""),
                        "input": evt.payload.get("input", {}),
                    }

        for evt in reversed(buffer):
            if evt.event_type == "assistant_text":
                return {"tool": "__thinking__", "input": {}}
            if evt.event_type in ("result", "user_message"):
                break

        return None

    def clear_buffer(self, session_id: str):
        self._event_buffers.pop(session_id, None)

    async def restore_seq_counters(self, db: "Database"):
        """서버 재시작 시 DB에서 세션별 최대 seq를 복원."""
        try:
            from app.repositories.event_repo import EventRepository

            async with db.session() as session:
                repo = EventRepository(session)
                seq_map = await repo.get_max_seq_per_session()
                for session_id, max_seq in seq_map.items():
                    self._seq_counters[session_id] = max_seq
                if seq_map:
                    logger.info("seq 카운터 복원 완료: %d개 세션", len(seq_map))
        except Exception as e:
            logger.warning("seq 카운터 복원 실패: %s", e)

    def reset_session(self, session_id: str):
        self._event_buffers.pop(session_id, None)
        self._seq_counters.pop(session_id, None)
