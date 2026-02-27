"""워크플로우 게이트 테스트.

ws.py _handle_prompt 함수의 워크플로우 게이트 로직을 검증합니다:
- 게이트 1: workflow_phase=None → 자동 복구 (첫 step으로)
- 게이트 2: workflow_phase_status == "awaiting_approval" → 프롬프트 차단
- 정상 흐름: workflow_phase 있음 → 프롬프트 허용
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.api.v1.endpoints.ws import _handle_prompt
from app.models.event_types import WsEventType


def _make_mock_ws():
    """테스트용 mock WebSocket 생성."""
    ws = AsyncMock()
    ws.send_json = AsyncMock()
    return ws


def _make_mock_manager(session_data: dict | None = None):
    """테스트용 mock SessionManager 생성."""
    manager = AsyncMock()
    manager.get = AsyncMock(return_value=session_data)
    manager.get_runner_task = MagicMock(return_value=None)
    manager.set_runner_task = MagicMock()
    manager.add_message = AsyncMock()
    manager.update_settings = AsyncMock()
    return manager


def _make_mock_ws_manager():
    """테스트용 mock WebSocketManager 생성."""
    ws_manager = AsyncMock()
    ws_manager.broadcast_event = AsyncMock()
    return ws_manager


def _make_mock_runner():
    """테스트용 mock ClaudeRunner 생성."""
    runner = AsyncMock()
    runner.run = AsyncMock()
    return runner


def _make_mock_settings():
    """테스트용 mock Settings 생성."""
    settings = MagicMock()
    settings.claude_allowed_tools = "Read,Write"
    return settings


def _make_mock_def_service():
    """테스트용 mock WorkflowDefinitionService 생성."""
    step = MagicMock()
    step.name = "research"
    step.order_index = 0
    definition = MagicMock()
    definition.steps = [step]
    def_svc = AsyncMock()
    def_svc.get_or_default = AsyncMock(return_value=definition)
    return def_svc


@pytest.mark.asyncio
class TestWorkflowGate1:
    """게이트 1: workflow_phase=None → 자동 복구 (첫 step으로 설정 후 프롬프트 실행)."""

    async def test_auto_recovers_when_workflow_not_started(self):
        """워크플로우 활성화 + 미시작 상태에서 자동 복구 후 프롬프트 실행."""
        ws = _make_mock_ws()
        session_data = {
            "workflow_enabled": True,
            "workflow_phase": None,
            "workflow_phase_status": None,
            "allowed_tools": None,
            "name": "test",
        }
        manager = _make_mock_manager(session_data)

        mock_workflow_svc = AsyncMock()
        mock_workflow_svc.build_phase_context = AsyncMock(return_value=None)

        with (
            patch("app.api.v1.endpoints.ws.get_settings_service") as mock_settings_svc,
            patch("app.api.v1.endpoints.ws.get_mcp_service") as mock_mcp_svc,
            patch(
                "app.api.v1.endpoints.ws.get_workflow_definition_service"
            ) as mock_def_svc,
            patch(
                "app.api.v1.endpoints.ws.get_workflow_service",
                return_value=mock_workflow_svc,
            ),
            patch("asyncio.create_task") as mock_create_task,
        ):
            mock_svc = AsyncMock()
            mock_svc.get = AsyncMock(return_value={})
            mock_settings_svc.return_value = mock_svc
            mock_mcp_svc.return_value = MagicMock()
            mock_def_svc.return_value = _make_mock_def_service()

            mock_task = MagicMock()
            mock_task.add_done_callback = MagicMock()
            mock_create_task.return_value = mock_task

            await _handle_prompt(
                data={"prompt": "hello"},
                session_id="test-session",
                manager=manager,
                ws_manager=_make_mock_ws_manager(),
                ws=ws,
                settings=_make_mock_settings(),
                runner=_make_mock_runner(),
            )

        # 자동 복구: update_settings가 호출되어야 함
        manager.update_settings.assert_called()
        # runner task가 생성되어야 함 (자동 복구 후 프롬프트 실행)
        manager.add_message.assert_called_once()

    async def test_auto_recovers_when_workflow_phase_empty_string(self):
        """workflow_phase가 빈 문자열일 때도 자동 복구."""
        ws = _make_mock_ws()
        session_data = {
            "workflow_enabled": True,
            "workflow_phase": "",
            "workflow_phase_status": None,
            "allowed_tools": None,
            "name": "test",
        }
        manager = _make_mock_manager(session_data)

        mock_workflow_svc = AsyncMock()
        mock_workflow_svc.build_phase_context = AsyncMock(return_value=None)

        with (
            patch("app.api.v1.endpoints.ws.get_settings_service") as mock_settings_svc,
            patch("app.api.v1.endpoints.ws.get_mcp_service") as mock_mcp_svc,
            patch(
                "app.api.v1.endpoints.ws.get_workflow_definition_service"
            ) as mock_def_svc,
            patch(
                "app.api.v1.endpoints.ws.get_workflow_service",
                return_value=mock_workflow_svc,
            ),
            patch("asyncio.create_task") as mock_create_task,
        ):
            mock_svc = AsyncMock()
            mock_svc.get = AsyncMock(return_value={})
            mock_settings_svc.return_value = mock_svc
            mock_mcp_svc.return_value = MagicMock()
            mock_def_svc.return_value = _make_mock_def_service()

            mock_task = MagicMock()
            mock_task.add_done_callback = MagicMock()
            mock_create_task.return_value = mock_task

            await _handle_prompt(
                data={"prompt": "hello"},
                session_id="test-session",
                manager=manager,
                ws_manager=_make_mock_ws_manager(),
                ws=ws,
                settings=_make_mock_settings(),
                runner=_make_mock_runner(),
            )

        # 자동 복구 확인
        manager.update_settings.assert_called()
        manager.add_message.assert_called_once()


@pytest.mark.asyncio
class TestWorkflowGate2:
    """게이트 2: workflow_phase_status == 'awaiting_approval' → 프롬프트 차단."""

    async def test_blocks_prompt_when_awaiting_approval(self):
        """승인 대기 상태에서 프롬프트가 차단되는지 확인."""
        ws = _make_mock_ws()
        session_data = {
            "workflow_enabled": True,
            "workflow_phase": "research",
            "workflow_phase_status": "awaiting_approval",
            "allowed_tools": None,
            "name": "test",
        }
        manager = _make_mock_manager(session_data)

        with (
            patch("app.api.v1.endpoints.ws.get_settings_service") as mock_settings_svc,
            patch(
                "app.api.v1.endpoints.ws.get_workflow_definition_service"
            ) as mock_def_svc,
        ):
            mock_svc = AsyncMock()
            mock_svc.get = AsyncMock(return_value={})
            mock_settings_svc.return_value = mock_svc
            mock_def_svc.return_value = _make_mock_def_service()

            await _handle_prompt(
                data={"prompt": "hello"},
                session_id="test-session",
                manager=manager,
                ws_manager=_make_mock_ws_manager(),
                ws=ws,
                settings=_make_mock_settings(),
                runner=_make_mock_runner(),
            )

        call_args = ws.send_json.call_args[0][0]
        assert call_args["type"] == WsEventType.ERROR
        assert "현재 단계의 검토가 완료되지 않았습니다" in call_args["message"]

    async def test_blocks_all_phases_when_awaiting_approval(self):
        """모든 phase(research/plan/implement)에서 awaiting_approval이면 차단."""
        for phase in ["research", "plan", "implement"]:
            ws = _make_mock_ws()
            session_data = {
                "workflow_enabled": True,
                "workflow_phase": phase,
                "workflow_phase_status": "awaiting_approval",
                "allowed_tools": None,
                "name": "test",
            }
            manager = _make_mock_manager(session_data)

            with (
                patch(
                    "app.api.v1.endpoints.ws.get_settings_service"
                ) as mock_settings_svc,
                patch(
                    "app.api.v1.endpoints.ws.get_workflow_definition_service"
                ) as mock_def_svc,
            ):
                mock_svc = AsyncMock()
                mock_svc.get = AsyncMock(return_value={})
                mock_settings_svc.return_value = mock_svc
                mock_def_svc.return_value = _make_mock_def_service()

                await _handle_prompt(
                    data={"prompt": "hello"},
                    session_id=f"test-session-{phase}",
                    manager=manager,
                    ws_manager=_make_mock_ws_manager(),
                    ws=ws,
                    settings=_make_mock_settings(),
                    runner=_make_mock_runner(),
                )

            call_args = ws.send_json.call_args[0][0]
            assert call_args["type"] == WsEventType.ERROR, (
                f"phase={phase}에서 차단 실패"
            )


@pytest.mark.asyncio
class TestWorkflowAllowed:
    """워크플로우 게이트 통과: 정상 흐름."""

    async def test_allows_prompt_when_workflow_no_phase(self):
        """workflow_phase=None → 자동 복구 후 프롬프트 허용."""
        ws = _make_mock_ws()
        session_data = {
            "workflow_enabled": True,
            "workflow_phase": None,
            "workflow_phase_status": None,
            "allowed_tools": None,
            "name": "test",
            "system_prompt": None,
            "timeout_seconds": None,
            "permission_mode": None,
            "permission_required_tools": None,
            "model": None,
            "max_turns": None,
            "max_budget_usd": None,
            "system_prompt_mode": None,
            "disallowed_tools": None,
            "mcp_server_ids": None,
        }
        manager = _make_mock_manager(session_data)
        runner = _make_mock_runner()
        ws_manager = _make_mock_ws_manager()

        mock_workflow_svc = AsyncMock()
        mock_workflow_svc.build_phase_context = AsyncMock(return_value=None)

        with (
            patch("app.api.v1.endpoints.ws.get_settings_service") as mock_settings_svc,
            patch("app.api.v1.endpoints.ws.get_mcp_service") as mock_mcp_svc,
            patch(
                "app.api.v1.endpoints.ws.get_workflow_definition_service"
            ) as mock_def_svc,
            patch(
                "app.api.v1.endpoints.ws.get_workflow_service",
                return_value=mock_workflow_svc,
            ),
            patch("asyncio.create_task") as mock_create_task,
        ):
            mock_svc = AsyncMock()
            mock_svc.get = AsyncMock(return_value={})
            mock_settings_svc.return_value = mock_svc
            mock_mcp_svc.return_value = MagicMock()
            mock_def_svc.return_value = _make_mock_def_service()

            mock_task = MagicMock()
            mock_task.add_done_callback = MagicMock()
            mock_create_task.return_value = mock_task

            await _handle_prompt(
                data={"prompt": "hello"},
                session_id="test-session",
                manager=manager,
                ws_manager=ws_manager,
                ws=ws,
                settings=_make_mock_settings(),
                runner=runner,
            )

        # runner task가 생성되어야 함 (자동 복구 후 게이트 통과 확인)
        manager.add_message.assert_called_once()
        manager.set_runner_task.assert_called_once()

    async def test_allows_prompt_when_workflow_in_progress(self):
        """workflow_enabled=True + phase=research + status=in_progress → 허용."""
        ws = _make_mock_ws()
        session_data = {
            "workflow_enabled": True,
            "workflow_phase": "research",
            "workflow_phase_status": "in_progress",
            "allowed_tools": None,
            "name": "test",
            "system_prompt": None,
            "timeout_seconds": None,
            "permission_mode": None,
            "permission_required_tools": None,
            "model": None,
            "max_turns": None,
            "max_budget_usd": None,
            "system_prompt_mode": None,
            "disallowed_tools": None,
            "mcp_server_ids": None,
        }
        manager = _make_mock_manager(session_data)
        runner = _make_mock_runner()
        ws_manager = _make_mock_ws_manager()

        mock_workflow_svc = AsyncMock()
        mock_workflow_svc.build_phase_context = AsyncMock(return_value=None)

        with (
            patch("app.api.v1.endpoints.ws.get_settings_service") as mock_settings_svc,
            patch("app.api.v1.endpoints.ws.get_mcp_service") as mock_mcp_svc,
            patch(
                "app.api.v1.endpoints.ws.get_workflow_definition_service"
            ) as mock_def_svc,
            patch(
                "app.api.v1.endpoints.ws.get_workflow_service",
                return_value=mock_workflow_svc,
            ),
            patch("asyncio.create_task") as mock_create_task,
        ):
            mock_svc = AsyncMock()
            mock_svc.get = AsyncMock(return_value={})
            mock_settings_svc.return_value = mock_svc
            mock_mcp_svc.return_value = MagicMock()
            mock_def_svc.return_value = _make_mock_def_service()

            mock_task = MagicMock()
            mock_task.add_done_callback = MagicMock()
            mock_create_task.return_value = mock_task

            await _handle_prompt(
                data={"prompt": "research this"},
                session_id="test-session",
                manager=manager,
                ws_manager=ws_manager,
                ws=ws,
                settings=_make_mock_settings(),
                runner=runner,
            )

        manager.add_message.assert_called_once()
        manager.set_runner_task.assert_called_once()


@pytest.mark.asyncio
class TestPromptValidation:
    """기본 프롬프트 유효성 검사."""

    async def test_empty_prompt_rejected(self):
        """빈 프롬프트가 거부되는지 확인."""
        ws = _make_mock_ws()

        await _handle_prompt(
            data={"prompt": ""},
            session_id="test-session",
            manager=_make_mock_manager(),
            ws_manager=_make_mock_ws_manager(),
            ws=ws,
            settings=_make_mock_settings(),
            runner=_make_mock_runner(),
        )

        call_args = ws.send_json.call_args[0][0]
        assert call_args["type"] == WsEventType.ERROR
        assert "프롬프트가 비어있습니다" in call_args["message"]

    async def test_duplicate_runner_rejected(self):
        """이미 실행 중인 runner가 있으면 거부."""
        ws = _make_mock_ws()
        manager = _make_mock_manager({"workflow_enabled": True})
        manager.get_runner_task = MagicMock(return_value=MagicMock())  # 기존 task 존재

        with patch("app.api.v1.endpoints.ws.get_settings_service") as mock_settings_svc:
            mock_svc = AsyncMock()
            mock_svc.get = AsyncMock(return_value={})
            mock_settings_svc.return_value = mock_svc

            await _handle_prompt(
                data={"prompt": "hello"},
                session_id="test-session",
                manager=manager,
                ws_manager=_make_mock_ws_manager(),
                ws=ws,
                settings=_make_mock_settings(),
                runner=_make_mock_runner(),
            )

        call_args = ws.send_json.call_args[0][0]
        assert call_args["type"] == WsEventType.ERROR
        assert "이미 실행 중인 요청이 있습니다" in call_args["message"]
