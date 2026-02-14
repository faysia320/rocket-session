"""Test permissions module - request/response mechanism."""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from app.api.v1.endpoints.permissions import (
    MAX_PENDING,
    PermissionRequest,
    clear_pending,
    get_pending,
    request_permission,
    respond_permission,
)


@pytest.fixture(autouse=True)
def reset_pending():
    """각 테스트 전후 pending 딕셔너리 초기화."""
    pending = get_pending()
    pending.clear()
    yield
    pending.clear()


@pytest.fixture
def mock_ws_manager():
    """Mock WebSocketManager for permissions tests."""
    manager = AsyncMock()
    manager.broadcast_event = AsyncMock()
    return manager


@pytest.mark.asyncio
class TestPermissionsPending:
    """Test pending request storage."""

    async def test_get_pending_initial_empty(self):
        """초기 상태는 빈 딕셔너리."""
        pending = get_pending()
        assert isinstance(pending, dict)
        assert len(pending) == 0

    async def test_clear_pending_empty(self):
        """빈 pending에서 clear_pending 호출 시 에러 없음."""
        clear_pending()
        pending = get_pending()
        assert len(pending) == 0

    async def test_clear_pending_denies_all(self):
        """clear_pending는 모든 pending 요청을 deny하고 clear."""
        pending = get_pending()

        # 2개의 pending 요청 추가
        event1 = asyncio.Event()
        event2 = asyncio.Event()
        entry1 = {
            "event": event1,
            "response": None,
            "permission_id": "req1",
            "session_id": "sess1",
        }
        entry2 = {
            "event": event2,
            "response": None,
            "permission_id": "req2",
            "session_id": "sess2",
        }
        pending["req1"] = entry1
        pending["req2"] = entry2

        # clear_pending 호출 전 entry 참조 저장
        entries = [entry1, entry2]

        clear_pending()

        # 모든 event가 set되고, response가 deny로 설정됨
        for entry in entries:
            assert entry["event"].is_set()
            assert entry["response"] == {"behavior": "deny"}

        # pending이 clear됨
        assert len(pending) == 0


@pytest.mark.asyncio
class TestRespondPermission:
    """Test respond_permission function."""

    async def test_respond_permission_not_found(self, mock_ws_manager):
        """존재하지 않는 permission_id → False 반환."""
        with patch(
            "app.api.v1.endpoints.permissions.get_ws_manager",
            return_value=mock_ws_manager,
        ):
            result = await respond_permission("nonexistent", "allow")
            assert result is False
            mock_ws_manager.broadcast_event.assert_not_called()

    async def test_respond_permission_success(self, mock_ws_manager):
        """정상 응답 → True 반환, event set."""
        pending = get_pending()
        event = asyncio.Event()
        pending["perm123"] = {
            "event": event,
            "response": None,
            "permission_id": "perm123",
            "session_id": "sess1",
            "tool_name": "Write",
            "tool_input": {"file": "test.py"},
        }

        with patch(
            "app.api.v1.endpoints.permissions.get_ws_manager",
            return_value=mock_ws_manager,
        ):
            result = await respond_permission("perm123", "allow")

        assert result is True
        assert event.is_set()
        assert pending["perm123"]["response"] == {"behavior": "allow"}
        mock_ws_manager.broadcast_event.assert_called_once_with(
            "sess1",
            {
                "type": "permission_response",
                "permission_id": "perm123",
                "behavior": "allow",
            },
        )

    async def test_respond_permission_deny(self, mock_ws_manager):
        """deny 응답도 정상 처리."""
        pending = get_pending()
        event = asyncio.Event()
        pending["perm456"] = {
            "event": event,
            "response": None,
            "permission_id": "perm456",
            "session_id": "sess2",
        }

        with patch(
            "app.api.v1.endpoints.permissions.get_ws_manager",
            return_value=mock_ws_manager,
        ):
            result = await respond_permission("perm456", "deny")

        assert result is True
        assert event.is_set()
        assert pending["perm456"]["response"] == {"behavior": "deny"}


@pytest.mark.asyncio
class TestRequestPermission:
    """Test request_permission endpoint function."""

    async def test_request_permission_with_response(self, mock_ws_manager):
        """request_permission + respond_permission 통합 테스트."""
        session_id = "sess1"
        body = PermissionRequest(tool_name="Write", tool_input={"file": "test.py"})

        with patch(
            "app.api.v1.endpoints.permissions.get_ws_manager",
            return_value=mock_ws_manager,
        ):
            # request_permission을 백그라운드 태스크로 실행
            request_task = asyncio.create_task(request_permission(session_id, body))

            # 짧은 대기 후 respond_permission 호출
            await asyncio.sleep(0.1)
            pending = get_pending()
            assert len(pending) == 1
            permission_id = list(pending.keys())[0]

            # 응답 전송
            await respond_permission(permission_id, "allow")

            # request_permission의 응답 대기
            response = await request_task

        assert response == {"behavior": "allow"}
        assert len(get_pending()) == 0  # finally 블록에서 제거됨

    async def test_request_permission_timeout(self, mock_ws_manager):
        """request_permission 타임아웃 시 deny 반환."""
        session_id = "sess1"
        body = PermissionRequest(tool_name="Write", tool_input={"file": "test.py"})

        # 짧은 타임아웃으로 패치
        with patch(
            "app.api.v1.endpoints.permissions.get_ws_manager",
            return_value=mock_ws_manager,
        ):
            with patch(
                "asyncio.wait_for",
                side_effect=asyncio.TimeoutError(),
            ):
                response = await request_permission(session_id, body)

        assert response == {"behavior": "deny"}
        # 타임아웃 후 pending이 제거됨
        assert len(get_pending()) == 0
        # 타임아웃 알림 브로드캐스트 확인
        assert mock_ws_manager.broadcast_event.call_count == 2  # 요청 + 타임아웃 응답

    async def test_request_permission_max_pending(self, mock_ws_manager):
        """pending 초과 시 가장 오래된 요청 자동 deny."""
        pending = get_pending()

        # MAX_PENDING개의 요청으로 채우기
        for i in range(MAX_PENDING):
            event = asyncio.Event()
            pending[f"perm{i}"] = {
                "event": event,
                "response": None,
                "permission_id": f"perm{i}",
                "session_id": "sess1",
            }

        # 가장 오래된 요청의 event 저장
        first_entry = pending["perm0"]
        first_event = first_entry["event"]

        with patch(
            "app.api.v1.endpoints.permissions.get_ws_manager",
            return_value=mock_ws_manager,
        ):
            # 새 요청 추가 (MAX_PENDING 초과)
            body = PermissionRequest(tool_name="Write", tool_input={"file": "new.py"})
            request_task = asyncio.create_task(
                request_permission("sess_new", body)
            )

            # 짧은 대기 후 확인
            await asyncio.sleep(0.1)

            # perm0이 제거되고 deny 처리됨
            assert "perm0" not in pending
            assert first_event.is_set()
            assert first_entry["response"] == {"behavior": "deny"}

            # 새 요청이 추가됨
            assert len(pending) == MAX_PENDING

            # 새 요청에 응답하여 task 종료
            new_perm_id = [k for k in pending.keys() if k.startswith("perm") is False][
                0
            ]
            await respond_permission(new_perm_id, "allow")
            await request_task

    async def test_request_permission_broadcasts_to_frontend(self, mock_ws_manager):
        """request_permission이 WebSocket으로 프론트엔드에 브로드캐스트."""
        session_id = "sess1"
        body = PermissionRequest(tool_name="Bash", tool_input={"command": "ls"})

        with patch(
            "app.api.v1.endpoints.permissions.get_ws_manager",
            return_value=mock_ws_manager,
        ):
            request_task = asyncio.create_task(request_permission(session_id, body))

            # 브로드캐스트 확인
            await asyncio.sleep(0.1)
            assert mock_ws_manager.broadcast_event.call_count == 1
            call_args = mock_ws_manager.broadcast_event.call_args
            assert call_args[0][0] == session_id
            event_data = call_args[0][1]
            assert event_data["type"] == "permission_request"
            assert event_data["tool_name"] == "Bash"
            assert event_data["tool_input"] == {"command": "ls"}
            assert "permission_id" in event_data

            # 응답하여 task 종료
            pending = get_pending()
            permission_id = list(pending.keys())[0]
            await respond_permission(permission_id, "deny")
            await request_task
