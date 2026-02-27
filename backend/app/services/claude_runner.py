"""Claude Code CLI subprocess 실행 및 스트림 파싱."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
import sys
import tempfile
from collections import OrderedDict
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

from aiolimiter import AsyncLimiter

from app.core.config import Settings
from app.core.constants import READONLY_TOOLS
from app.core.utils import utc_now, utc_now_iso
from app.models.event_types import CliEventType, WsEventType
from app.models.session import SessionStatus
from app.services.event_handler import (
    extract_result_data,
    extract_tool_result_output,
    extract_tool_use_info,
)
from app.services.websocket_manager import WebSocketManager

if TYPE_CHECKING:
    from app.services.session_manager import SessionManager

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class WorkflowContext:
    """run() 메서드의 워크플로우 관련 파라미터를 묶는 데이터 클래스."""

    phase: str | None = None
    service: object | None = None
    step_config: dict | None = None
    original_prompt: str | None = None


@dataclass
class TurnState:
    """현재 턴의 공유 상태.

    plain dict 대신 dataclass를 사용하여 IDE 자동완성 및 키 오타를 방지합니다.
    """

    text: str = ""
    model: str | None = None
    work_dir: str = ""
    worktree_name: str | None = None
    workflow_phase: str | None = None
    result_received: bool = False
    result_text: str | None = None
    is_error: bool = False
    should_terminate: bool = False
    ask_user_question_tool_id: str | None = None
    exit_plan_tool_id: str | None = None
    exit_plan_content: str | None = None
    exit_plan_allowed_prompts: list = field(default_factory=list)
    seen_tool_use_ids: set = field(default_factory=set)


class _AsyncStreamReader:
    """Windows subprocess 파이프를 비동기로 읽기 위한 래퍼."""

    def __init__(self, stream):
        self._stream = stream

    async def readline(self):
        return await asyncio.to_thread(self._stream.readline)

    async def read(self):
        return await asyncio.to_thread(self._stream.read)


class _AsyncProcessWrapper:
    """subprocess.Popen을 asyncio.Process 인터페이스로 감싸는 래퍼 (Windows용)."""

    def __init__(self, popen: subprocess.Popen):
        self._popen = popen
        self.stdout = _AsyncStreamReader(popen.stdout)
        self.stderr = _AsyncStreamReader(popen.stderr)
        self.pid = popen.pid

    def terminate(self):
        self._popen.terminate()

    def kill(self):
        self._popen.kill()

    async def wait(self):
        return await asyncio.to_thread(self._popen.wait)

    @property
    def returncode(self):
        return self._popen.returncode


def _auto_chain_done(
    task: asyncio.Task, session_id: str, manager: "SessionManager"
) -> None:
    """자동 체이닝 task 완료 콜백: task 일치 시에만 정리."""
    manager.clear_runner_task_if_match(session_id, task)
    if not task.cancelled() and task.exception():
        logger.error(
            "Auto-chain task 비정상 종료 (세션 %s): %s",
            session_id,
            task.exception(),
        )


class ClaudeRunner:
    """Claude Code CLI를 subprocess로 실행하고 출력을 파싱하여 브로드캐스트."""

    _MAX_TOOL_OUTPUT_LENGTH = 5000

    # 특수 도구 이름 상수
    TOOL_ASK_USER_QUESTION = "AskUserQuestion"
    TOOL_EXIT_PLAN_MODE = "ExitPlanMode"
    FILE_WRITE_TOOLS = frozenset({"Write", "Edit", "MultiEdit"})

    # subprocess 버퍼 크기 (bytes)
    _SUBPROCESS_BUFFER_LIMIT = 10 * 1024 * 1024  # 10MB

    # 프로세스 종료 타임아웃 (초)
    _GRACEFUL_TERMINATE_TIMEOUT = 5.0
    _STDERR_READ_TIMEOUT = 10.0
    _PROCESS_WAIT_TIMEOUT = 10.0

    def __init__(self, settings: Settings):
        self._settings = settings
        self._semaphore = asyncio.Semaphore(settings.max_concurrent_sessions)
        # 글로벌 레이트 리미터: 분당 최대 세션 시작 수
        self._global_limiter = AsyncLimiter(
            max_rate=settings.rate_limit_global_per_minute, time_period=60
        )
        # 세션별 레이트 리미터: 분당 최대 프롬프트 수 (LRU 제한)
        self._session_limiters: OrderedDict[str, AsyncLimiter] = OrderedDict()
        self._max_session_limiters: int = 200
        self._session_rate_per_minute = settings.rate_limit_session_per_minute

    @staticmethod
    async def _terminate_process(
        process, graceful_timeout: float = 5.0, session_id: str = ""
    ) -> None:
        """프로세스를 graceful 종료 시도 후, 타임아웃 시 강제 종료."""
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), timeout=graceful_timeout)
        except asyncio.TimeoutError:
            if session_id:
                logger.warning(
                    "세션 %s: 프로세스 종료 대기 타임아웃 — 강제 종료", session_id
                )
            process.kill()

    @staticmethod
    async def _update_and_broadcast_status(
        session_id: str,
        status: str,
        session_manager: "SessionManager",
        ws_manager: WebSocketManager,
    ) -> None:
        """세션 상태 업데이트 + WebSocket 브로드캐스트를 단일 호출로 통합."""
        await session_manager.update_status(session_id, status)
        await ws_manager.broadcast_event(
            session_id, {"type": WsEventType.STATUS, "status": status}
        )

    @staticmethod
    def _copy_images_to_workdir(images: list[str], work_dir: str) -> list[str]:
        """이미지 파일을 작업 디렉토리의 .rocket-uploads/에 복사하고 경로 목록 반환."""
        import shutil

        if not work_dir:
            return []

        upload_dir = Path(work_dir) / ".rocket-uploads"
        upload_dir.mkdir(parents=True, exist_ok=True)

        copied = []
        for img_path in images:
            src = Path(img_path)
            if src.exists() and src.is_file():
                dest = upload_dir / src.name
                try:
                    shutil.copy2(str(src), str(dest))
                    copied.append(str(dest))
                except OSError:
                    logger.warning("이미지 복사 실패: %s", img_path, exc_info=True)
        return copied

    def _build_command(
        self,
        session: dict,
        prompt: str,
        allowed_tools: str,
        session_id: str,
        images: list[str] | None = None,
        workflow_phase: str | None = None,
        workflow_step_config: dict | None = None,
    ) -> tuple[list[str], str | None, Path | None]:
        """CLI 커맨드를 구성하고, (cmd, system_prompt, mcp_config_path)를 반환."""
        cmd = ["claude", "-p", prompt, "--output-format", "stream-json", "--verbose"]

        # 워크트리 세션: claude -w <name> 플래그 추가
        worktree_name = session.get("worktree_name")
        if worktree_name:
            cmd.extend(["-w", worktree_name])

        system_prompt = session.get("system_prompt")
        mcp_config_path = None

        # 워크플로우 phase 기반 동작 (definition의 step constraints 사용)
        if workflow_phase and workflow_step_config:
            constraints = workflow_step_config.get("constraints", "readonly")
            if constraints == "full":
                pass  # 전체 도구 허용
            elif constraints == "readonly":
                cmd.extend(["--permission-mode", "plan"])
                allowed_tools = READONLY_TOOLS
            else:
                # 커스텀 도구 목록
                cmd.extend(["--permission-mode", "plan"])
                allowed_tools = constraints
        elif workflow_phase in ("research", "plan"):
            # 하위 호환: step_config 없이 호출된 경우
            cmd.extend(["--permission-mode", "plan"])
            allowed_tools = READONLY_TOOLS
        elif workflow_phase == "implement":
            pass
        elif session.get("permission_mode"):
            # Permission MCP는 _setup_mcp_config에서 통합 처리됨
            required = session.get("permission_required_tools") or []
            if required and allowed_tools:
                tool_list = [t.strip() for t in allowed_tools.split(",")]
                allowed_tools = ",".join(t for t in tool_list if t not in required)

        if allowed_tools:
            cmd.extend(["--allowedTools", allowed_tools])

        model = session.get("model")
        if model:
            cmd.extend(["--model", model])

        # fallback_model
        fallback_model = session.get("fallback_model")
        if fallback_model:
            cmd.extend(["--fallback-model", fallback_model])

        # additional_dirs
        for add_dir in session.get("additional_dirs") or []:
            if add_dir and add_dir.strip():
                cmd.extend(["--add-dir", add_dir.strip()])

        # system_prompt: 모드에 따라 플래그 분기
        if system_prompt:
            if session.get("system_prompt_mode") == "append":
                cmd.extend(["--append-system-prompt", system_prompt])
            else:
                cmd.extend(["--system-prompt", system_prompt])

        # max_turns
        max_turns = session.get("max_turns")
        if max_turns and max_turns > 0:
            cmd.extend(["--max-turns", str(max_turns)])

        # max_budget_usd
        max_budget = session.get("max_budget_usd")
        if max_budget and max_budget > 0:
            cmd.extend(["--max-budget-usd", str(max_budget)])

        # disallowed_tools
        disallowed_tools = session.get("disallowed_tools")
        if disallowed_tools:
            cmd.extend(["--disallowedTools", disallowed_tools])

        claude_session_id = session.get("claude_session_id")
        if claude_session_id:
            cmd.extend(["--resume", claude_session_id])

        # 이미지 파일: 작업 디렉토리에 복사 후 프롬프트에 참조 삽입
        if images:
            work_dir = session.get("work_dir", "")
            copied_paths = self._copy_images_to_workdir(images, work_dir)
            if copied_paths:
                image_refs = "\n".join(f"- {p}" for p in copied_paths)
                image_instruction = f"\n\n[첨부된 이미지 파일입니다. Read 도구로 확인하세요:\n{image_refs}\n]"
                # prompt는 cmd[2] (cmd = ["claude", "-p", prompt, ...])
                cmd[2] = cmd[2] + image_instruction

        return cmd, system_prompt, mcp_config_path

    def _build_permission_mcp_dict(self, session_id: str) -> dict:
        """Permission MCP 서버 설정 dict를 반환 (파일 기록 없이)."""
        mcp_server_script = str(Path(__file__).parent / "permission_mcp_server.py")
        return {
            "permission": {
                "command": sys.executable,
                "args": [mcp_server_script],
                "env": {
                    "PERMISSION_SESSION_ID": session_id,
                    "PERMISSION_API_BASE": f"http://localhost:{self._settings.backend_port}",
                    "PERMISSION_TIMEOUT": "120",
                },
            }
        }

    def _write_mcp_config(self, session_id: str, config: dict) -> Path:
        """MCP config dict를 임시 파일에 기록하고 Path를 반환."""
        mcp_config_path = Path(tempfile.gettempdir()) / f"mcp-{session_id}.json"
        mcp_config_path.write_text(json.dumps(config), encoding="utf-8")
        return mcp_config_path

    async def _setup_mcp_config(
        self,
        session: dict,
        session_id: str,
        cmd: list[str],
        mcp_service=None,
    ) -> Path | None:
        """사용자 MCP 서버 + Permission MCP를 병합하여 --mcp-config에 추가.

        Returns:
            mcp_config_path: 생성된 임시 파일 경로 (정리 대상), 없으면 None
        """
        has_permission = bool(session.get("permission_mode"))

        # 세션의 mcp_server_ids (JSONB → Python list)
        mcp_ids: list[str] = session.get("mcp_server_ids") or []

        # MCP 서버도 없고 Permission도 없으면 스킵
        if not mcp_ids and not has_permission:
            return None

        # Permission MCP dict
        permission_dict = None
        if has_permission:
            permission_dict = self._build_permission_mcp_dict(session_id)

        # mcp_service를 통해 통합 config 빌드
        if mcp_service and mcp_ids:
            config = await mcp_service.build_mcp_config(mcp_ids, permission_dict)
        elif permission_dict:
            config = {"mcpServers": permission_dict}
        else:
            return None

        # 병합된 config가 비어있으면 스킵
        if not config.get("mcpServers"):
            return None

        mcp_config_path = self._write_mcp_config(session_id, config)
        cmd.extend(["--mcp-config", str(mcp_config_path)])

        # MCP 도구 패턴을 --allowedTools에 자동 병합
        # config에서 서버 이름 추출 (permission 서버 제외)
        server_names = [
            name for name in config.get("mcpServers", {}) if name != "permission"
        ]
        if server_names:
            mcp_patterns = ",".join(f"mcp__{name}__*" for name in server_names)
            try:
                idx = cmd.index("--allowedTools")
                cmd[idx + 1] = f"{cmd[idx + 1]},{mcp_patterns}"
            except ValueError:
                pass  # --allowedTools 없으면 모든 도구 허용 → 추가 불필요

        if has_permission:
            cmd.extend(["--permission-prompt-tool", "mcp__permission__handle_request"])

        return mcp_config_path

    async def _start_process(
        self, cmd: list[str], work_dir: str
    ) -> _AsyncProcessWrapper | asyncio.subprocess.Process:
        """플랫폼에 맞는 subprocess를 시작."""
        env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}

        if sys.platform == "win32":
            popen = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=work_dir,
                env=env,
            )
            return _AsyncProcessWrapper(popen)

        return await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=work_dir,
            env=env,
            limit=self._SUBPROCESS_BUFFER_LIMIT,
        )

    @staticmethod
    def _normalize_file_path(
        file_path: str, work_dir: str, worktree_name: str | None = None
    ) -> str:
        """파일 경로를 work_dir(또는 워크트리) 기준 상대 경로로 정규화한다.

        CLI가 절대 경로를 반환하는 경우, 기준 디렉토리 하위이면 상대 경로로 변환한다.
        워크트리 세션에서는 {work_dir}/.claude/worktrees/{name}/ 기준으로 정규화한다.
        """
        effective_dir = work_dir
        if worktree_name:
            wt_path = str(Path(work_dir) / ".claude" / "worktrees" / worktree_name)
            if Path(wt_path).is_dir():
                effective_dir = wt_path
        p = Path(file_path)
        if p.is_absolute():
            try:
                return str(p.resolve().relative_to(Path(effective_dir).resolve()))
            except ValueError:
                # 기준 디렉토리 외부 경로는 그대로 반환
                return file_path
        return file_path

    async def _handle_stream_event(
        self,
        event: dict,
        session_id: str,
        ws_manager: WebSocketManager,
        session_manager: SessionManager,
        turn_state: TurnState,
    ) -> None:
        """파싱된 JSON 이벤트를 타입별로 처리."""
        event_type = event.get("type", "")

        if event_type == CliEventType.SYSTEM:
            # session_id가 있으면 Claude 세션 연결, 없으면 일반 system 이벤트로 전달
            if event.get("session_id"):
                await session_manager.update_claude_session_id(
                    session_id, event["session_id"]
                )
                await ws_manager.broadcast_event(
                    session_id,
                    {
                        "type": WsEventType.SESSION_INFO,
                        "claude_session_id": event["session_id"],
                    },
                )
            else:
                await ws_manager.broadcast_event(
                    session_id, {"type": WsEventType.EVENT, "event": event}
                )

        elif event_type == CliEventType.ASSISTANT:
            await self._handle_assistant_event(
                event, session_id, ws_manager, session_manager, turn_state
            )

        elif event_type == CliEventType.USER:
            await self._handle_user_event(
                event, session_id, ws_manager, session_manager, turn_state
            )

        elif event_type == CliEventType.RESULT:
            await self._handle_result_event(
                event,
                session_id,
                ws_manager,
                session_manager,
                turn_state,
            )

        else:
            await ws_manager.broadcast_event(
                session_id, {"type": WsEventType.EVENT, "event": event}
            )

    async def _handle_thinking_block(
        self,
        block: dict,
        session_id: str,
        ws_manager: WebSocketManager,
    ) -> None:
        """thinking 블록 처리 (extended thinking 모드)."""
        thinking_text = block.get("thinking", "")
        if thinking_text:
            await ws_manager.broadcast_event(
                session_id,
                {
                    "type": WsEventType.THINKING,
                    "text": thinking_text,
                    "timestamp": utc_now_iso(),
                },
            )

    async def _handle_tool_use_block(
        self,
        block: dict,
        session_id: str,
        ws_manager: WebSocketManager,
        session_manager: "SessionManager",
        turn_state: TurnState,
    ) -> bool:
        """tool_use 블록 처리. should_continue=True이면 다음 블록 건너뜀."""
        tool_name, tool_input, tool_use_id = extract_tool_use_info(block)

        # 진단 로깅: name이 비어있으면 전체 블록 덤프
        if not tool_name:
            logger.warning(
                "tool_use 블록에 name 누락 (tool_use_id=%s): %s",
                tool_use_id,
                json.dumps(block, ensure_ascii=False, default=str)[:500],
            )
            return False  # 불완전한 블록 스킵, 후속 완전한 블록 대기

        # 중복 방지: 동일 tool_use_id가 이미 처리됨
        if tool_use_id and tool_use_id in turn_state.seen_tool_use_ids:
            return False
        if tool_use_id:
            turn_state.seen_tool_use_ids.add(tool_use_id)

        # AskUserQuestion 감지: 인터랙티브 질문 이벤트로 변환
        if tool_name == self.TOOL_ASK_USER_QUESTION:
            turn_state.ask_user_question_tool_id = tool_use_id
            turn_state.should_terminate = True
            question_timestamp = utc_now_iso()
            question_list = tool_input.get("questions", [])
            await ws_manager.broadcast_event(
                session_id,
                {
                    "type": WsEventType.ASK_USER_QUESTION,
                    "questions": question_list,
                    "tool_use_id": tool_use_id,
                    "timestamp": question_timestamp,
                },
            )
            from app.services.pending_questions import set_pending_question

            await set_pending_question(
                session_id=session_id,
                questions=question_list,
                tool_use_id=tool_use_id,
                timestamp=question_timestamp,
            )
            return True

        # ExitPlanMode 감지: 상세 플랜을 turn_state에 캡처
        if tool_name == self.TOOL_EXIT_PLAN_MODE:
            plan_content = tool_input.get("plan", "")
            allowed_prompts = tool_input.get("allowedPrompts", [])
            if plan_content:
                turn_state.exit_plan_content = plan_content
                turn_state.exit_plan_allowed_prompts = allowed_prompts
            turn_state.exit_plan_tool_id = tool_use_id
            return True

        # 일반 tool_use 브로드캐스트
        await ws_manager.broadcast_event(
            session_id,
            {
                "type": WsEventType.TOOL_USE,
                "tool": tool_name,
                "input": tool_input,
                "tool_use_id": tool_use_id,
                "timestamp": utc_now_iso(),
            },
        )
        ts = utc_now()
        if not session_manager.queue_message(
            session_id=session_id,
            role="assistant",
            content="",
            timestamp=ts,
            message_type="tool_use",
            tool_use_id=tool_use_id,
            tool_name=tool_name,
            tool_input=tool_input,
        ):
            await session_manager.add_message(
                session_id=session_id,
                role="assistant",
                content="",
                timestamp=ts,
                message_type="tool_use",
                tool_use_id=tool_use_id,
                tool_name=tool_name,
                tool_input=tool_input,
            )

        # 파일 변경 추적
        await self._handle_file_change_from_tool(
            tool_name, tool_input, session_id, ws_manager, session_manager, turn_state
        )
        return False

    async def _handle_file_change_from_tool(
        self,
        tool_name: str,
        tool_input: dict,
        session_id: str,
        ws_manager: WebSocketManager,
        session_manager: "SessionManager",
        turn_state: TurnState,
    ) -> None:
        """Write/Edit/MultiEdit 도구 사용 시 파일 변경을 기록+브로드캐스트."""
        if tool_name not in self.FILE_WRITE_TOOLS:
            return

        raw_path = tool_input.get("file_path") or tool_input.get("path") or ""
        work_dir = turn_state.work_dir
        wt_name = turn_state.worktree_name
        file_path = (
            self._normalize_file_path(raw_path, work_dir, wt_name)
            if work_dir
            else raw_path
        )
        normalized = file_path.replace("\\", "/")
        if normalized.startswith(".claude/plans/") or "/.claude/plans/" in normalized:
            return

        ts_dt = utc_now()
        await session_manager.add_file_change(session_id, tool_name, file_path, ts_dt)
        await ws_manager.broadcast_event(
            session_id,
            {
                "type": WsEventType.FILE_CHANGE,
                "change": {
                    "tool": tool_name,
                    "file": file_path,
                    "timestamp": ts_dt.isoformat(),
                },
            },
        )

    async def _handle_assistant_event(
        self,
        event: dict,
        session_id: str,
        ws_manager: WebSocketManager,
        session_manager: "SessionManager",
        turn_state: TurnState,
    ) -> None:
        """assistant 타입 이벤트 처리."""
        msg = event.get("message", {})
        content_blocks = msg.get("content", [])

        model = msg.get("model")
        if model:
            turn_state.model = model

        has_new_text = False
        for block in content_blocks:
            block_type = block.get("type")
            if block_type == "thinking":
                await self._handle_thinking_block(block, session_id, ws_manager)
            elif block_type == "text":
                turn_state.text = block.get("text", "")
                has_new_text = True
            elif block_type == "tool_use":
                should_skip = await self._handle_tool_use_block(
                    block, session_id, ws_manager, session_manager, turn_state
                )
                if should_skip:
                    continue

        if has_new_text and turn_state.text:
            await ws_manager.broadcast_event(
                session_id,
                {
                    "type": WsEventType.ASSISTANT_TEXT,
                    "text": turn_state.text,
                    "timestamp": utc_now_iso(),
                },
            )
            await self._try_handle_delegate_commands(session_id, turn_state.text)

    @staticmethod
    async def _try_handle_delegate_commands(session_id: str, text: str) -> None:
        """리드 세션의 @delegate 패턴 자동 위임 (TeamCoordinator에 위임)."""
        try:
            from app.api.dependencies import get_team_coordinator

            coordinator = get_team_coordinator()
            await coordinator.try_handle_delegate_commands(session_id, text)
        except Exception:
            logger.debug(
                "세션 %s: TeamCoordinator @delegate 처리 실패 (미초기화)",
                session_id,
            )

    async def _handle_user_event(
        self,
        event: dict,
        session_id: str,
        ws_manager: WebSocketManager,
        session_manager: SessionManager,
        turn_state: TurnState,
    ) -> None:
        """user 타입 이벤트 (tool_result) 처리."""
        msg = event.get("message", {})
        content_blocks = msg.get("content", [])
        for block in content_blocks:
            if block.get("type") == "tool_result":
                tool_use_id = block.get("tool_use_id", "")

                # AskUserQuestion의 tool_result는 프론트엔드에 전송하지 않음
                if tool_use_id == turn_state.ask_user_question_tool_id:
                    turn_state.ask_user_question_tool_id = None
                    continue

                # ExitPlanMode의 tool_result도 프론트엔드에 전송하지 않음
                if tool_use_id == turn_state.exit_plan_tool_id:
                    turn_state.exit_plan_tool_id = None
                    continue

                result_info = extract_tool_result_output(
                    block, max_length=self._MAX_TOOL_OUTPUT_LENGTH
                )
                await ws_manager.broadcast_event(
                    session_id,
                    {
                        "type": WsEventType.TOOL_RESULT,
                        "tool_use_id": tool_use_id,
                        **result_info,
                        "timestamp": utc_now_iso(),
                    },
                )

                # tool_result를 messages 테이블에 저장 (히스토리 복원용)
                ts = utc_now()
                if not session_manager.queue_message(
                    session_id=session_id,
                    role="tool",
                    content=result_info["output"],
                    timestamp=ts,
                    is_error=result_info["is_error"],
                    message_type="tool_result",
                    tool_use_id=tool_use_id,
                ):
                    await session_manager.add_message(
                        session_id=session_id,
                        role="tool",
                        content=result_info["output"],
                        timestamp=ts,
                        is_error=result_info["is_error"],
                        message_type="tool_result",
                        tool_use_id=tool_use_id,
                    )

    async def _handle_result_event(
        self,
        event: dict,
        session_id: str,
        ws_manager: WebSocketManager,
        session_manager: SessionManager,
        turn_state: TurnState,
    ) -> None:
        """result 타입 이벤트 처리."""
        data = extract_result_data(event, turn_state)
        result_text = data["result_text"]
        is_error = data["is_error"]
        cost_info = data["cost"]
        duration = data["duration_ms"]
        session_id_from_result = data["session_id"]
        input_tokens = data["input_tokens"]
        output_tokens = data["output_tokens"]
        cache_creation_tokens = data["cache_creation_tokens"]
        cache_read_tokens = data["cache_read_tokens"]
        model = data["model"]

        if session_id_from_result:
            await session_manager.update_claude_session_id(
                session_id, session_id_from_result
            )

        turn_state.result_received = True
        turn_state.result_text = result_text
        turn_state.is_error = is_error

        result_event = {
            "type": WsEventType.RESULT,
            "text": result_text,
            "is_error": is_error,
            "cost": cost_info,
            "duration_ms": duration,
            "session_id": session_id_from_result,
            "workflow_phase": turn_state.workflow_phase,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cache_creation_tokens": cache_creation_tokens,
            "cache_read_tokens": cache_read_tokens,
            "model": model,
            "timestamp": utc_now_iso(),
        }
        await ws_manager.broadcast_event(session_id, result_event)

        # is_error일 때 세션 상태를 error로 전환
        if is_error:
            await session_manager.update_status(session_id, SessionStatus.ERROR)
            await ws_manager.broadcast_event(
                session_id, {"type": WsEventType.STATUS, "status": SessionStatus.ERROR}
            )

        await session_manager.add_message(
            session_id=session_id,
            role="assistant",
            content=result_text,
            timestamp=utc_now(),
            cost=cost_info,
            duration_ms=duration,
            is_error=is_error,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_creation_tokens=cache_creation_tokens,
            cache_read_tokens=cache_read_tokens,
            model=model,
        )

        # 토큰 스냅샷 기록 (세션 삭제와 무관하게 보존)
        try:
            await session_manager.add_token_snapshot(
                session_id=session_id,
                work_dir=turn_state.work_dir,
                timestamp=utc_now(),
                workflow_phase=turn_state.workflow_phase,
                model=model,
                input_tokens=input_tokens or 0,
                output_tokens=output_tokens or 0,
                cache_creation_tokens=cache_creation_tokens or 0,
                cache_read_tokens=cache_read_tokens or 0,
            )
        except Exception:
            logger.warning(
                "토큰 스냅샷 기록 실패: session=%s", session_id, exc_info=True
            )

    @staticmethod
    def create_turn_state(
        work_dir: str = "",
        worktree_name: str | None = None,
        workflow_phase: str | None = None,
    ) -> TurnState:
        """TurnState 인스턴스를 생성."""
        return TurnState(
            work_dir=work_dir,
            worktree_name=worktree_name,
            workflow_phase=workflow_phase,
        )

    async def _parse_stream(
        self,
        process,
        session_id: str,
        ws_manager: WebSocketManager,
        session_manager: SessionManager,
        turn_state: TurnState,
    ) -> None:
        """subprocess stdout에서 JSON 스트림을 읽고 이벤트별로 처리.

        turn_state dict를 in-place로 갱신합니다.
        should_terminate 키가 True이면 AskUserQuestion으로 인한 조기 중단을 의미.
        """

        while True:
            line = await process.stdout.readline()
            if not line:
                break

            line_str = line.decode("utf-8").strip()
            if not line_str:
                continue

            try:
                event = json.loads(line_str)
            except json.JSONDecodeError:
                await ws_manager.broadcast_event(
                    session_id, {"type": WsEventType.RAW, "text": line_str}
                )
                continue

            await self._handle_stream_event(
                event,
                session_id,
                ws_manager,
                session_manager,
                turn_state,
            )

            # AskUserQuestion 감지 시 스트림 파싱 중단 (caller에서 프로세스 종료)
            if turn_state.should_terminate:
                break

    @staticmethod
    def _cleanup_mcp_config(mcp_config_path: Path | None) -> None:
        """MCP config 임시 파일 정리."""
        if mcp_config_path and mcp_config_path.exists():
            try:
                mcp_config_path.unlink()
            except OSError:
                logger.debug("MCP config 정리 실패: %s", mcp_config_path, exc_info=True)

    @asynccontextmanager
    async def _mcp_config_scope(self, session, session_id, cmd, mcp_service=None):
        """MCP config 파일 생성 → yield → 정리를 보장하는 컨텍스트 매니저."""
        mcp_config_path = await self._setup_mcp_config(
            session, session_id, cmd, mcp_service
        )
        try:
            yield mcp_config_path
        finally:
            self._cleanup_mcp_config(mcp_config_path)

    async def _run_process_lifecycle(
        self,
        cmd: list[str],
        session: dict,
        session_id: str,
        ws_manager: WebSocketManager,
        session_manager: "SessionManager",
        turn_state: TurnState,
    ) -> None:
        """프로세스 시작 → 스트림 파싱 → 종료 처리."""
        timeout_seconds = session.get("timeout_seconds")
        process = await self._start_process(cmd, session["work_dir"])
        session_manager.set_process(session_id, process)

        # 타임아웃 적용
        if timeout_seconds and timeout_seconds > 0:
            try:
                await asyncio.wait_for(
                    self._parse_stream(
                        process,
                        session_id,
                        ws_manager,
                        session_manager,
                        turn_state=turn_state,
                    ),
                    timeout=timeout_seconds,
                )
            except asyncio.TimeoutError:
                logger.warning(
                    "세션 %s: 타임아웃 (%d초) 초과", session_id, timeout_seconds
                )
                await self._terminate_process(
                    process, self._GRACEFUL_TERMINATE_TIMEOUT, session_id
                )
                await ws_manager.broadcast_event(
                    session_id,
                    {
                        "type": WsEventType.ERROR,
                        "message": f"프로세스 타임아웃 ({timeout_seconds}초) 초과로 종료되었습니다.",
                    },
                )
        else:
            await self._parse_stream(
                process,
                session_id,
                ws_manager,
                session_manager,
                turn_state=turn_state,
            )

        # AskUserQuestion으로 인한 조기 중단
        if turn_state.should_terminate:
            logger.info(
                "세션 %s: AskUserQuestion 감지 — 사용자 응답 대기를 위해 프로세스 종료",
                session_id,
            )
            await self._terminate_process(
                process, self._GRACEFUL_TERMINATE_TIMEOUT, session_id
            )
        else:
            # 정상 흐름: stderr 읽기와 프로세스 대기를 병렬 실행
            async def _read_stderr():
                try:
                    if not process.stderr:
                        return
                    stderr = await asyncio.wait_for(
                        process.stderr.read(), timeout=self._STDERR_READ_TIMEOUT
                    )
                    if stderr:
                        stderr_text = stderr.decode("utf-8").strip()
                        if stderr_text:
                            await ws_manager.broadcast_event(
                                session_id,
                                {"type": WsEventType.STDERR, "text": stderr_text},
                            )
                except asyncio.TimeoutError:
                    logger.warning(
                        "세션 %s: stderr 읽기 타임아웃 (%d초)",
                        session_id,
                        self._STDERR_READ_TIMEOUT,
                    )

            async def _wait_process():
                try:
                    await asyncio.wait_for(
                        process.wait(), timeout=self._PROCESS_WAIT_TIMEOUT
                    )
                except asyncio.TimeoutError:
                    logger.warning(
                        "세션 %s: 프로세스 종료 대기 타임아웃 — 강제 종료",
                        session_id,
                    )
                    process.kill()

            await asyncio.gather(_read_stderr(), _wait_process())

    async def _handle_workflow_completion(
        self,
        session_id: str,
        turn_state: TurnState,
        prompt: str,
        allowed_tools: str,
        ws_manager: WebSocketManager,
        session_manager: "SessionManager",
        workflow_phase: str,
        workflow_service,
        workflow_step_config: dict | None,
        original_prompt: str | None,
        mcp_service=None,
    ) -> None:
        """워크플로우 완료 처리: 아티팩트 저장 + 다음 phase 결정."""
        result_text = (
            turn_state.exit_plan_content or turn_state.result_text or turn_state.text
        )
        if result_text:
            try:
                await workflow_service.create_artifact(
                    session_id=session_id,
                    phase=workflow_phase,
                    content=result_text,
                )
            except Exception:
                logger.warning(
                    "세션 %s: %s 아티팩트 저장 실패",
                    session_id,
                    workflow_phase,
                    exc_info=True,
                )

        # step config로 후속 동작 결정
        step = workflow_step_config or {}
        review_required = step.get("review_required", False)
        next_phase = await workflow_service.get_next_phase(
            workflow_phase, session_id, session_manager
        )

        if not next_phase:
            # 마지막 단계 완료 → 워크플로우 종료
            try:
                await session_manager.update_settings(
                    session_id,
                    workflow_phase=workflow_phase,
                    workflow_phase_status="completed",
                )
                await ws_manager.broadcast_event(
                    session_id,
                    {"type": WsEventType.WORKFLOW_COMPLETED},
                )
                logger.info("워크플로우 완료: session=%s", session_id)
            except Exception:
                logger.warning(
                    "세션 %s: 워크플로우 완료 처리 실패",
                    session_id,
                    exc_info=True,
                )

        elif not review_required:
            # 승인 불필요 → 자동 승인 + 다음 phase 자동 실행
            try:
                await workflow_service.approve_phase(
                    session_id, session_manager=session_manager
                )
                await ws_manager.broadcast_event(
                    session_id,
                    {
                        "type": WsEventType.WORKFLOW_PHASE_APPROVED,
                        "phase": workflow_phase,
                        "next_phase": next_phase,
                    },
                )
                await ws_manager.broadcast_event(
                    session_id,
                    {
                        "type": WsEventType.WORKFLOW_AUTO_CHAIN,
                        "from_phase": workflow_phase,
                        "to_phase": next_phase,
                    },
                )
                raw_prompt = original_prompt or prompt
                next_context = await workflow_service.build_phase_context(
                    session_id,
                    next_phase,
                    raw_prompt,
                    session_manager=session_manager,
                )
                next_steps = await workflow_service._get_steps(
                    session_id, session_manager
                )
                next_step_config = next(
                    (s for s in next_steps if s.name == next_phase), None
                )
                updated = await session_manager.get(session_id)
                chain_task = asyncio.create_task(
                    self.run(
                        updated,
                        next_context,
                        allowed_tools,
                        session_id,
                        ws_manager,
                        session_manager,
                        mcp_service=mcp_service,
                        workflow_phase=next_phase,
                        workflow_service=workflow_service,
                        original_prompt=raw_prompt,
                        workflow_step_config=(
                            next_step_config.model_dump() if next_step_config else None
                        ),
                    )
                )
                chain_task.add_done_callback(
                    lambda t: _auto_chain_done(t, session_id, session_manager)
                )
                session_manager.set_runner_task(session_id, chain_task)
            except Exception:
                logger.warning(
                    "세션 %s: %s→%s 자동 체이닝 실패",
                    session_id,
                    workflow_phase,
                    next_phase,
                    exc_info=True,
                )

        else:
            # 승인 필요 → 사용자 승인 대기
            try:
                await session_manager.update_settings(
                    session_id,
                    workflow_phase_status="awaiting_approval",
                )
                await ws_manager.broadcast_event(
                    session_id,
                    {
                        "type": WsEventType.WORKFLOW_PHASE_COMPLETED,
                        "phase": workflow_phase,
                    },
                )
                # QA phase인 경우 체크리스트 파싱 후 결과 이벤트 추가 전송
                if workflow_phase == "qa" and result_text:
                    try:
                        qa_result = workflow_service.parse_qa_checklist(result_text)
                        if not qa_result["all_passed"]:
                            await ws_manager.broadcast_event(
                                session_id,
                                {
                                    "type": WsEventType.WORKFLOW_QA_FAILED,
                                    "phase": workflow_phase,
                                    "qa_result": qa_result,
                                },
                            )
                    except Exception:
                        logger.debug("세션 %s: QA 체크리스트 파싱 스킵", session_id)
            except Exception:
                logger.warning(
                    "세션 %s: %s phase 완료 처리 실패",
                    session_id,
                    workflow_phase,
                    exc_info=True,
                )

    async def run(
        self,
        session: dict,
        prompt: str,
        allowed_tools: str,
        session_id: str,
        ws_manager: WebSocketManager,
        session_manager: "SessionManager",
        images: list[str] | None = None,
        mcp_service=None,
        workflow_phase: str | None = None,
        workflow_service=None,
        original_prompt: str | None = None,
        workflow_step_config: dict | None = None,
    ):
        """Claude CLI 실행 및 스트림 처리 오케스트레이션."""
        # 세션별 레이트 리미터 (분당 프롬프트 수 제한)
        if session_id not in self._session_limiters:
            self._session_limiters[session_id] = AsyncLimiter(
                max_rate=self._session_rate_per_minute, time_period=60
            )
        self._session_limiters.move_to_end(session_id)
        while len(self._session_limiters) > self._max_session_limiters:
            self._session_limiters.popitem(last=False)
        await self._session_limiters[session_id].acquire()

        # 글로벌 레이트 리미터 (분당 전체 세션 시작 수 제한)
        await self._global_limiter.acquire()

        # 세마포어 대기 (동시 세션 제한)
        if self._semaphore.locked():
            logger.info(
                "세션 %s: 동시 실행 한도 도달 — 대기 중 (%d/%d)",
                session_id,
                self._settings.max_concurrent_sessions - self._semaphore._value,
                self._settings.max_concurrent_sessions,
            )
            await ws_manager.broadcast_event(
                session_id,
                {
                    "type": WsEventType.STATUS,
                    "status": "queued",
                    "message": "동시 실행 한도에 도달하여 대기 중입니다.",
                },
            )

        async with self._semaphore:
            await self._run_inner(
                session,
                prompt,
                allowed_tools,
                session_id,
                ws_manager,
                session_manager,
                images,
                mcp_service,
                workflow_phase,
                workflow_service,
                original_prompt,
                workflow_step_config,
            )

    def cleanup_session_limiter(self, session_id: str) -> None:
        """세션 삭제 시 해당 세션의 레이트 리미터를 정리."""
        self._session_limiters.pop(session_id, None)

    async def _run_inner(
        self,
        session: dict,
        prompt: str,
        allowed_tools: str,
        session_id: str,
        ws_manager: WebSocketManager,
        session_manager: "SessionManager",
        images: list[str] | None = None,
        mcp_service=None,
        workflow_phase: str | None = None,
        workflow_service=None,
        original_prompt: str | None = None,
        workflow_step_config: dict | None = None,
    ):
        """세마포어 내부에서 실행되는 실제 CLI 실행 로직."""
        await self._update_and_broadcast_status(
            session_id, SessionStatus.RUNNING, session_manager, ws_manager
        )

        cmd, _, _ = await asyncio.to_thread(
            self._build_command,
            session,
            prompt,
            allowed_tools,
            session_id,
            images,
            workflow_phase,
            workflow_step_config,
        )

        work_dir = session.get("work_dir", "")
        worktree_name = session.get("worktree_name")
        turn_state = self.create_turn_state(
            work_dir=work_dir,
            worktree_name=worktree_name,
            workflow_phase=workflow_phase,
        )

        async with self._mcp_config_scope(session, session_id, cmd, mcp_service):
            try:
                await self._run_process_lifecycle(
                    cmd,
                    session,
                    session_id,
                    ws_manager,
                    session_manager,
                    turn_state,
                )
            except Exception as e:
                error_msg = str(e) or f"{type(e).__name__}: (no message)"
                logger.error(
                    "세션 %s 실행 오류: %s", session_id, error_msg, exc_info=True
                )
                await self._update_and_broadcast_status(
                    session_id, SessionStatus.ERROR, session_manager, ws_manager
                )
                await ws_manager.broadcast_event(
                    session_id, {"type": WsEventType.ERROR, "message": error_msg}
                )

            finally:
                # 비정상 종료 시 스트리밍 중이던 텍스트를 DB에 저장 (데이터 유실 방지)
                if (
                    turn_state.text
                    and not turn_state.result_received
                    and not turn_state.should_terminate
                ):
                    logger.info(
                        "세션 %s: result 미수신 상태에서 종료 — partial text 저장 (%d자)",
                        session_id,
                        len(turn_state.text),
                    )
                    try:
                        await session_manager.add_message(
                            session_id=session_id,
                            role="assistant",
                            content=turn_state.text,
                            timestamp=utc_now(),
                            is_error=False,
                            model=turn_state.model,
                        )
                    except Exception:
                        logger.warning(
                            "세션 %s: partial text DB 저장 실패",
                            session_id,
                            exc_info=True,
                        )

                # 턴 종료 시 잔여 배치 메시지 flush
                await session_manager.flush_messages()

                # ERROR 상태인 경우 보존, 그 외에는 IDLE로 전환
                current_session = await session_manager.get(session_id)
                current_status = (
                    current_session.get("status") if current_session else None
                )
                if current_status != SessionStatus.ERROR:
                    await session_manager.update_status(session_id, SessionStatus.IDLE)
                final_status = (
                    current_status
                    if current_status == SessionStatus.ERROR
                    else SessionStatus.IDLE
                )
                session_manager.clear_process(session_id)
                await ws_manager.broadcast_event(
                    session_id, {"type": WsEventType.STATUS, "status": final_status}
                )
                await ws_manager.flush_events()
                ws_manager.clear_buffer(session_id)

                # 워크플로우 완료 처리
                if (
                    workflow_phase
                    and workflow_service
                    and turn_state.result_received
                    and not turn_state.is_error
                ):
                    await self._handle_workflow_completion(
                        session_id,
                        turn_state,
                        prompt,
                        allowed_tools,
                        ws_manager,
                        session_manager,
                        workflow_phase,
                        workflow_service,
                        workflow_step_config,
                        original_prompt,
                        mcp_service,
                    )

                # 팀 코디네이터 콜백: 세션 완료 시 팀 태스크 자동 완료
                try:
                    from app.api.dependencies import get_team_coordinator

                    coordinator = get_team_coordinator()
                    last_text = turn_state.text if turn_state else None
                    await coordinator.on_session_completed(session_id, last_text)
                except Exception as e:
                    if "초기화되지 않았습니다" not in str(e):
                        logger.warning("세션 %s: 팀 콜백 실패: %s", session_id, e)

