"""WebSocket 연결 레지스트리 및 브로드캐스트 관리."""

from __future__ import annotations

import asyncio
import json
import logging
from collections import deque
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING

from fastapi import WebSocket

from app.core.utils import utc_now
from app.repositories.event_repo import EventRepository
from app.services.base import DBService
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
    timestamp: datetime


class WebSocketManager(DBService):
    """세션별 WebSocket 연결 관리, 이벤트 버퍼링 및 메시지 브로드캐스트."""

    def __init__(
        self,
        event_queue_maxsize: int = 50000,
        event_flush_interval: float = 0.2,
        event_batch_max_size: int = 1000,
        heartbeat_interval: int = 15,
    ):
        # DBService.__init__ 호출하지 않음: DB는 set_database()로 지연 주입
        self._db: Database | None = None
        self._connections: dict[str, set[WebSocket]] = {}
        self._event_buffers: dict[str, deque[BufferedEvent]] = {}
        self._seq_counters: dict[str, int] = {}
        self._event_queue: asyncio.Queue[dict] = asyncio.Queue(
            maxsize=event_queue_maxsize
        )
        self._event_flush_interval = event_flush_interval
        self._event_batch_max_size = event_batch_max_size
        self._heartbeat_interval = heartbeat_interval
        self._flush_task: asyncio.Task | None = None
        self._heartbeat_task: asyncio.Task | None = None
        self._pending_broadcasts: set[asyncio.Task] = set()
        # 이벤트 재시도 버퍼
        self._retry_batch: list[dict] = []
        self._retry_count: int = 0
        self._max_retries: int = 3
        # 관측성 카운터
        self._events_dropped: int = 0
        self._broadcast_failures: int = 0

    def set_database(self, db: Database):
        """DB 참조 설정 (의존성 주입)."""
        self._db = db

    async def start_background_tasks(self):
        """배치 writer + heartbeat 백그라운드 태스크 시작."""
        if self._flush_task and not self._flush_task.done():
            return  # 이미 실행 중
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
        # 진행 중인 broadcast 완료 대기
        if self._pending_broadcasts:
            await asyncio.gather(*self._pending_broadcasts, return_exceptions=True)
            self._pending_broadcasts.clear()
        await self._flush_events()

    async def _batch_writer_loop(self):
        """주기적으로 큐에 쌓인 이벤트를 배치 DB 저장."""
        while True:
            await asyncio.sleep(self._event_flush_interval)
            await self._flush_events()

    async def _flush_events(self):
        """큐의 이벤트를 한번에 배치로 저장 (배치 최대 크기 제한 + 재시도)."""
        batch: list[dict] = []
        # 재시도 대기 이벤트 먼저 소비
        if self._retry_batch:
            batch.extend(self._retry_batch)
            self._retry_batch = []
        # 큐에서 배치 최대 크기까지 꺼내기
        while not self._event_queue.empty() and len(batch) < self._event_batch_max_size:
            try:
                batch.append(self._event_queue.get_nowait())
            except asyncio.QueueEmpty:
                break
        if not batch or not self._db:
            return

        # 재시도 배치 크기 상한: 무한 증가 방지
        max_retry_size = self._event_batch_max_size * 2
        if len(batch) > max_retry_size:
            dropped = len(batch) - max_retry_size
            batch = batch[-max_retry_size:]  # 최신 이벤트 유지
            logger.warning("재시도 배치 크기 초과 — %d건 드롭", dropped)
            self._events_dropped += dropped

        try:
            # asyncpg COPY 프로토콜 시도 (5~50배 빠름)
            try:
                async with self._db.raw_connection() as raw_conn:
                    await EventRepository.add_batch_copy(raw_conn, batch)
                self._retry_count = 0
                return  # COPY 성공 시 즉시 반환 — INSERT fallback 도달 방지
            except Exception:
                # COPY 실패 시 기존 INSERT fallback
                async with self._session_scope(EventRepository) as (session, repo):
                    await repo.add_batch(batch)
                    await session.commit()
            self._retry_count = 0
        except Exception as e:
            self._retry_count += 1
            if self._retry_count <= self._max_retries:
                logger.warning(
                    "이벤트 배치 DB 저장 실패 (%d건, 재시도 %d/%d): %s",
                    len(batch),
                    self._retry_count,
                    self._max_retries,
                    e,
                )
                self._retry_batch = batch
            else:
                logger.error(
                    "이벤트 배치 DB 저장 최종 실패 — %d건 드롭 (재시도 %d회 초과): %s",
                    len(batch),
                    self._max_retries,
                    e,
                )
                self._events_dropped += len(batch)
                self._retry_count = 0

    async def flush_events(self):
        """외부에서 호출 가능한 이벤트 flush."""
        await self._flush_events()

    async def _heartbeat_loop(self):
        """주기적 ping으로 dead 연결 감지."""
        ping_payload = json.dumps({"type": "ping"})
        while True:
            await asyncio.sleep(self._heartbeat_interval)
            for session_id, ws_set in list(self._connections.items()):
                if not ws_set:
                    continue

                async def _ping(ws: WebSocket) -> WebSocket | None:
                    try:
                        if ws.client_state != WebSocketState.CONNECTED:
                            return ws
                        await asyncio.wait_for(ws.send_text(ping_payload), timeout=5.0)
                        return None
                    except Exception:
                        return ws

                results = await asyncio.gather(*[_ping(ws) for ws in list(ws_set)])
                dead = {ws for ws in results if ws is not None}
                if dead:
                    ws_set -= dead

    def register(self, session_id: str, ws: WebSocket):
        if session_id not in self._connections:
            self._connections[session_id] = set()
        self._connections[session_id].add(ws)

    def unregister(self, session_id: str, ws: WebSocket):
        ws_set = self._connections.get(session_id)
        if ws_set:
            ws_set.discard(ws)
        # 빈 set 정리
        if not ws_set and session_id in self._connections:
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
        ts = utc_now()

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
                # 긴급 flush 후 재시도
                logger.warning(
                    "이벤트 큐 가득 참 — 긴급 flush 시도 (세션 %s, seq %d)",
                    session_id,
                    seq,
                )
                await self._flush_events()
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
                    logger.error(
                        "이벤트 큐 긴급 flush 후에도 가득 참 — 이벤트 드롭 (세션 %s, seq %d)",
                        session_id,
                        seq,
                    )
                    self._events_dropped += 1

        # fire-and-forget: 느린 WS 클라이언트가 stdout 파이프라인을 블로킹하지 않도록
        task = asyncio.create_task(self.broadcast(session_id, message_with_seq))
        self._pending_broadcasts.add(task)

        def _on_broadcast_done(t: asyncio.Task) -> None:
            self._pending_broadcasts.discard(t)
            if not t.cancelled():
                exc = t.exception()
                if exc:
                    logger.warning("Broadcast 실패 (세션 %s): %s", session_id, exc)
                    self._broadcast_failures += 1

        task.add_done_callback(_on_broadcast_done)
        return seq

    async def broadcast(self, session_id: str, message: dict):
        """세션에 연결된 모든 WebSocket에 메시지 병렬 전송."""
        ws_set = self._connections.get(session_id)
        if not ws_set:
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

        results = await asyncio.gather(*[_safe_send(ws) for ws in list(ws_set)])
        dead = {ws for ws in results if ws is not None}
        if dead:
            ws_set -= dead

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
                async with self._session_scope(EventRepository) as (session, repo):
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
                async with self._session_scope(EventRepository) as (session, repo):
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
            async with db.session() as session:
                repo = EventRepository(session)
                seq_map = await repo.get_max_seq_per_session()
                for session_id, max_seq in seq_map.items():
                    self._seq_counters[session_id] = max_seq
                if seq_map:
                    logger.info("seq 카운터 복원 완료: %d개 세션", len(seq_map))
        except Exception as e:
            logger.warning("seq 카운터 복원 실패: %s", e)

    def get_metrics(self) -> dict:
        """WebSocket 서비스 메트릭 반환."""
        total_connections = sum(len(ws_set) for ws_set in self._connections.values())
        return {
            "connections": total_connections,
            "sessions_with_connections": len(self._connections),
            "event_queue_size": self._event_queue.qsize(),
            "event_queue_maxsize": self._event_queue.maxsize,
            "pending_broadcasts": len(self._pending_broadcasts),
            "retry_batch_size": len(self._retry_batch),
            "retry_count": self._retry_count,
            "events_dropped": self._events_dropped,
            "broadcast_failures": self._broadcast_failures,
        }

    def reset_session(self, session_id: str):
        self._event_buffers.pop(session_id, None)
        self._seq_counters.pop(session_id, None)
