"""WebSocketManager comprehensive test suite."""

import json
from unittest.mock import AsyncMock

import pytest
from starlette.websockets import WebSocketState


@pytest.mark.asyncio
async def test_register_websocket(ws_manager, mock_websocket):
    """WebSocket 등록 동작 확인."""
    session_id = "test-session"
    ws_manager.register(session_id, mock_websocket)

    assert session_id in ws_manager._connections
    assert mock_websocket in ws_manager._connections[session_id]
    assert len(ws_manager._connections[session_id]) == 1


@pytest.mark.asyncio
async def test_register_multiple_websockets(ws_manager, mock_websocket):
    """동일 세션에 여러 WebSocket 등록."""
    session_id = "test-session"
    ws2 = AsyncMock()
    ws2.client_state = WebSocketState.CONNECTED
    ws2.send_json = AsyncMock()

    ws_manager.register(session_id, mock_websocket)
    ws_manager.register(session_id, ws2)

    assert len(ws_manager._connections[session_id]) == 2


@pytest.mark.asyncio
async def test_unregister_websocket(ws_manager, mock_websocket):
    """WebSocket 해제 동작 확인."""
    session_id = "test-session"
    ws_manager.register(session_id, mock_websocket)
    ws_manager.unregister(session_id, mock_websocket)

    assert mock_websocket not in ws_manager._connections.get(session_id, [])


@pytest.mark.asyncio
async def test_unregister_nonexistent_websocket(ws_manager, mock_websocket):
    """등록되지 않은 WebSocket 해제 시도 시 에러 없음."""
    session_id = "test-session"
    ws_manager.unregister(session_id, mock_websocket)  # Should not raise


@pytest.mark.asyncio
async def test_has_connections_true(ws_manager, mock_websocket):
    """연결 유무 확인 - 연결 있음."""
    session_id = "test-session"
    ws_manager.register(session_id, mock_websocket)

    assert ws_manager.has_connections(session_id) is True


@pytest.mark.asyncio
async def test_has_connections_false(ws_manager):
    """연결 유무 확인 - 연결 없음."""
    session_id = "test-session"
    assert ws_manager.has_connections(session_id) is False


@pytest.mark.asyncio
async def test_next_seq_increments(ws_manager):
    """시퀀스 번호가 순차 증가하는지 확인."""
    session_id = "test-session"

    seq1 = ws_manager._next_seq(session_id)
    seq2 = ws_manager._next_seq(session_id)
    seq3 = ws_manager._next_seq(session_id)

    assert seq1 == 1
    assert seq2 == 2
    assert seq3 == 3


@pytest.mark.asyncio
async def test_get_latest_seq_initial_zero(ws_manager):
    """초기 latest seq는 0."""
    session_id = "test-session"
    assert ws_manager.get_latest_seq(session_id) == 0


@pytest.mark.asyncio
async def test_get_latest_seq_after_increment(ws_manager):
    """seq 증가 후 latest seq 확인."""
    session_id = "test-session"
    ws_manager._next_seq(session_id)
    ws_manager._next_seq(session_id)

    assert ws_manager.get_latest_seq(session_id) == 2


@pytest.mark.asyncio
async def test_broadcast_event_assigns_seq(ws_manager, mock_websocket):
    """broadcast_event가 seq를 부여하고 메시지에 포함하는지 확인."""
    session_id = "test-session"
    ws_manager.register(session_id, mock_websocket)

    message = {"type": "status", "data": "running"}
    seq = await ws_manager.broadcast_event(session_id, message)

    assert seq == 1
    mock_websocket.send_json.assert_called_once()
    sent_message = mock_websocket.send_json.call_args[0][0]
    assert sent_message["seq"] == 1
    assert sent_message["type"] == "status"


@pytest.mark.asyncio
async def test_broadcast_event_stores_in_memory(ws_manager):
    """broadcast_event가 인메모리 버퍼에 저장하는지 확인."""
    session_id = "test-session"
    message = {"type": "assistant", "text": "Hello"}

    await ws_manager.broadcast_event(session_id, message)

    assert session_id in ws_manager._event_buffers
    buffer = ws_manager._event_buffers[session_id]
    assert len(buffer) == 1
    assert buffer[0].seq == 1
    assert buffer[0].event_type == "assistant"
    assert buffer[0].payload["text"] == "Hello"


@pytest.mark.asyncio
async def test_broadcast_event_stores_in_db(ws_manager_with_db, db):
    """broadcast_event가 DB에 저장하는지 확인."""
    session_id = "test-session"
    # FOREIGN KEY 제약 조건을 위해 세션 먼저 생성
    await db.create_session(
        session_id=session_id,
        work_dir="/tmp",
        created_at="2024-01-01T00:00:00Z",
    )
    message = {"type": "tool_use", "tool": "Read", "path": "test.py"}

    await ws_manager_with_db.broadcast_event(session_id, message)

    # DB에서 이벤트 조회
    rows = await db.get_events_after(session_id, 0)
    assert len(rows) == 1
    assert rows[0]["seq"] == 1
    assert rows[0]["event_type"] == "tool_use"
    payload = json.loads(rows[0]["payload"])
    assert payload["tool"] == "Read"


@pytest.mark.asyncio
async def test_broadcast_event_db_failure_continues_broadcast(ws_manager, mock_websocket):
    """DB 저장 실패해도 broadcast는 진행되는지 확인."""
    session_id = "test-session"
    ws_manager.register(session_id, mock_websocket)

    # DB가 없는 상태에서 broadcast_event (DB 저장은 건너뜀)
    message = {"type": "status", "data": "running"}
    seq = await ws_manager.broadcast_event(session_id, message)

    assert seq == 1
    mock_websocket.send_json.assert_called_once()


@pytest.mark.asyncio
async def test_broadcast_sends_to_all_connections(ws_manager, mock_websocket):
    """broadcast가 모든 연결에 전송하는지 확인."""
    session_id = "test-session"
    ws2 = AsyncMock()
    ws2.client_state = WebSocketState.CONNECTED
    ws2.send_json = AsyncMock()

    ws_manager.register(session_id, mock_websocket)
    ws_manager.register(session_id, ws2)

    message = {"type": "status", "data": "running"}
    await ws_manager.broadcast(session_id, message)

    mock_websocket.send_json.assert_called_once_with(message)
    ws2.send_json.assert_called_once_with(message)


@pytest.mark.asyncio
async def test_broadcast_removes_dead_connections(ws_manager, mock_websocket):
    """broadcast가 dead connection을 자동 정리하는지 확인."""
    session_id = "test-session"
    dead_ws = AsyncMock()
    dead_ws.client_state = WebSocketState.DISCONNECTED
    dead_ws.send_json = AsyncMock()

    ws_manager.register(session_id, mock_websocket)
    ws_manager.register(session_id, dead_ws)

    message = {"type": "status", "data": "running"}
    await ws_manager.broadcast(session_id, message)

    # dead_ws는 제거되어야 함
    assert dead_ws not in ws_manager._connections[session_id]
    assert mock_websocket in ws_manager._connections[session_id]


@pytest.mark.asyncio
async def test_broadcast_removes_websocket_on_send_exception(ws_manager, mock_websocket):
    """send_json 예외 발생 시 WebSocket을 제거하는지 확인."""
    session_id = "test-session"
    failing_ws = AsyncMock()
    failing_ws.client_state = WebSocketState.CONNECTED
    failing_ws.send_json = AsyncMock(side_effect=Exception("Send failed"))

    ws_manager.register(session_id, mock_websocket)
    ws_manager.register(session_id, failing_ws)

    message = {"type": "status", "data": "running"}
    await ws_manager.broadcast(session_id, message)

    # failing_ws는 제거되어야 함
    assert failing_ws not in ws_manager._connections[session_id]
    assert mock_websocket in ws_manager._connections[session_id]


@pytest.mark.asyncio
async def test_broadcast_no_connections(ws_manager):
    """세션에 연결이 없으면 broadcast는 아무것도 안 함."""
    session_id = "test-session"
    message = {"type": "status", "data": "running"}

    # Should not raise
    await ws_manager.broadcast(session_id, message)


@pytest.mark.asyncio
async def test_get_buffered_events_after_from_memory(ws_manager):
    """인메모리 버퍼에서 이벤트를 조회하는지 확인."""
    session_id = "test-session"

    await ws_manager.broadcast_event(session_id, {"type": "status", "data": "idle"})
    await ws_manager.broadcast_event(session_id, {"type": "assistant", "text": "Hello"})
    await ws_manager.broadcast_event(session_id, {"type": "tool_use", "tool": "Read"})

    events = await ws_manager.get_buffered_events_after(session_id, 1)

    assert len(events) == 2
    assert events[0]["seq"] == 2
    assert events[1]["seq"] == 3


@pytest.mark.asyncio
async def test_get_buffered_events_after_db_fallback(ws_manager_with_db, db):
    """인메모리에 없을 때 DB fallback 동작 확인."""
    session_id = "test-session"
    # FOREIGN KEY 제약 조건을 위해 세션 먼저 생성
    await db.create_session(
        session_id=session_id,
        work_dir="/tmp",
        created_at="2024-01-01T00:00:00Z",
    )

    # 이벤트 생성
    await ws_manager_with_db.broadcast_event(session_id, {"type": "status", "data": "idle"})
    await ws_manager_with_db.broadcast_event(session_id, {"type": "assistant", "text": "Hello"})

    # 인메모리 버퍼 정리
    ws_manager_with_db.clear_buffer(session_id)

    # DB에서 조회
    events = await ws_manager_with_db.get_buffered_events_after(session_id, 0)

    assert len(events) == 2
    assert events[0]["seq"] == 1
    assert events[1]["seq"] == 2


@pytest.mark.asyncio
async def test_get_current_turn_events_after_user_message(ws_manager):
    """마지막 user_message 이후 이벤트만 반환하는지 확인."""
    session_id = "test-session"

    await ws_manager.broadcast_event(session_id, {"type": "status", "data": "idle"})
    await ws_manager.broadcast_event(session_id, {"type": "user_message", "text": "Hi"})
    await ws_manager.broadcast_event(session_id, {"type": "assistant", "text": "Hello"})
    await ws_manager.broadcast_event(session_id, {"type": "tool_use", "tool": "Read"})

    events = ws_manager.get_current_turn_events(session_id)

    assert len(events) == 2
    assert events[0]["type"] == "assistant"
    assert events[1]["type"] == "tool_use"


@pytest.mark.asyncio
async def test_get_current_turn_events_no_user_message(ws_manager):
    """user_message가 없으면 빈 리스트 반환."""
    session_id = "test-session"

    await ws_manager.broadcast_event(session_id, {"type": "status", "data": "idle"})
    await ws_manager.broadcast_event(session_id, {"type": "assistant", "text": "Hello"})

    events = ws_manager.get_current_turn_events(session_id)

    assert len(events) == 0


@pytest.mark.asyncio
async def test_clear_buffer(ws_manager):
    """버퍼 정리가 동작하는지 확인."""
    session_id = "test-session"

    await ws_manager.broadcast_event(session_id, {"type": "status", "data": "idle"})
    assert session_id in ws_manager._event_buffers

    ws_manager.clear_buffer(session_id)

    assert session_id not in ws_manager._event_buffers


@pytest.mark.asyncio
async def test_restore_seq_counters_from_db(ws_manager, db):
    """DB에서 seq 카운터를 복원하는지 확인."""
    session_id1 = "session-1"
    session_id2 = "session-2"

    # FOREIGN KEY 제약 조건을 위해 세션 먼저 생성
    await db.create_session(
        session_id=session_id1,
        work_dir="/tmp",
        created_at="2024-01-01T00:00:00Z",
    )
    await db.create_session(
        session_id=session_id2,
        work_dir="/tmp",
        created_at="2024-01-01T00:00:00Z",
    )

    # DB에 이벤트 직접 추가
    await db.add_event(session_id1, 1, "status", "{}", "2024-01-01T00:00:00Z")
    await db.add_event(session_id1, 2, "assistant", "{}", "2024-01-01T00:00:01Z")
    await db.add_event(session_id2, 1, "status", "{}", "2024-01-01T00:00:02Z")
    await db.add_event(session_id2, 2, "tool_use", "{}", "2024-01-01T00:00:03Z")
    await db.add_event(session_id2, 3, "result", "{}", "2024-01-01T00:00:04Z")

    await ws_manager.restore_seq_counters(db)

    assert ws_manager.get_latest_seq(session_id1) == 2
    assert ws_manager.get_latest_seq(session_id2) == 3


@pytest.mark.asyncio
async def test_reset_session(ws_manager):
    """세션 초기화가 버퍼와 seq 카운터를 정리하는지 확인."""
    session_id = "test-session"

    await ws_manager.broadcast_event(session_id, {"type": "status", "data": "idle"})
    await ws_manager.broadcast_event(session_id, {"type": "assistant", "text": "Hello"})

    assert session_id in ws_manager._event_buffers
    assert ws_manager.get_latest_seq(session_id) == 2

    ws_manager.reset_session(session_id)

    assert session_id not in ws_manager._event_buffers
    assert ws_manager.get_latest_seq(session_id) == 0


@pytest.mark.asyncio
async def test_broadcast_event_multiple_sessions_independent_seq(ws_manager):
    """여러 세션의 seq가 독립적으로 관리되는지 확인."""
    session1 = "session-1"
    session2 = "session-2"

    seq1_1 = await ws_manager.broadcast_event(session1, {"type": "status"})
    seq2_1 = await ws_manager.broadcast_event(session2, {"type": "status"})
    seq1_2 = await ws_manager.broadcast_event(session1, {"type": "assistant"})
    seq2_2 = await ws_manager.broadcast_event(session2, {"type": "assistant"})

    assert seq1_1 == 1
    assert seq2_1 == 1
    assert seq1_2 == 2
    assert seq2_2 == 2
    assert ws_manager.get_latest_seq(session1) == 2
    assert ws_manager.get_latest_seq(session2) == 2


@pytest.mark.asyncio
async def test_broadcast_event_includes_original_message_fields(ws_manager, mock_websocket):
    """broadcast_event가 원본 메시지 필드를 유지하는지 확인."""
    session_id = "test-session"
    ws_manager.register(session_id, mock_websocket)

    message = {
        "type": "tool_use",
        "tool": "Read",
        "path": "/path/to/file.py",
        "nested": {"key": "value"},
    }
    await ws_manager.broadcast_event(session_id, message)

    sent_message = mock_websocket.send_json.call_args[0][0]
    assert sent_message["type"] == "tool_use"
    assert sent_message["tool"] == "Read"
    assert sent_message["path"] == "/path/to/file.py"
    assert sent_message["nested"]["key"] == "value"
    assert sent_message["seq"] == 1


@pytest.mark.asyncio
async def test_set_database(ws_manager, db):
    """set_database가 DB 참조를 설정하는지 확인."""
    ws_manager.set_database(db)
    assert ws_manager._db is db
