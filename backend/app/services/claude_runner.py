"""Claude Code CLI subprocess 실행 및 스트림 파싱."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from app.core.config import Settings
from app.core.constants import READONLY_TOOLS
from app.models.event_types import CliEventType, WsEventType
from app.models.session import SessionStatus
from app.services.event_handler import extract_result_data, extract_tool_result_output, utc_now
from app.services.websocket_manager import WebSocketManager

if TYPE_CHECKING:
    from app.services.session_manager import SessionManager

logger = logging.getLogger(__name__)


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

    def __init__(self, settings: Settings):
        self._settings = settings

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
    ) -> tuple[list[str], str | None, Path | None]:
        """CLI 커맨드를 구성하고, (cmd, system_prompt, mcp_config_path)를 반환."""
        cmd = ["claude", "-p", prompt, "--output-format", "stream-json", "--verbose"]

        # 워크트리 세션: claude -w <name> 플래그 추가
        worktree_name = session.get("worktree_name")
        if worktree_name:
            cmd.extend(["-w", worktree_name])

        system_prompt = session.get("system_prompt")
        mcp_config_path = None

        # 워크플로우 phase 기반 동작
        if workflow_phase in ("research", "plan"):
            # 읽기 전용: --permission-mode plan + 제한된 도구
            cmd.extend(["--permission-mode", "plan"])
            allowed_tools = READONLY_TOOLS
        elif workflow_phase == "implement":
            # 전체 도구 허용 (기존 allowed_tools 유지)
            pass
        elif not session.get("workflow_enabled"):
            # 비워크플로우 세션: 읽기전용 (분석/검색만 허용)
            cmd.extend(["--permission-mode", "plan"])
            allowed_tools = READONLY_TOOLS
        elif session.get("permission_mode"):
            # Permission MCP는 _setup_mcp_config에서 통합 처리됨
            # permission_required_tools에 해당하는 도구는 allowedTools에서 제외
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
            limit=10 * 1024 * 1024,  # 10MB - Claude 스트림 JSON 대용량 라인 대응
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
        turn_state: dict,
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

    async def _handle_assistant_event(
        self,
        event: dict,
        session_id: str,
        ws_manager: WebSocketManager,
        session_manager: SessionManager,
        turn_state: dict,
    ) -> None:
        """assistant 타입 이벤트 처리."""
        msg = event.get("message", {})
        content_blocks = msg.get("content", [])

        # 모델명 추출 (assistant 메시지에 포함됨)
        model = msg.get("model")
        if model:
            turn_state["model"] = model

        has_new_text = False
        for block in content_blocks:
            if block.get("type") == "thinking":
                # thinking 블록 (extended thinking 모드)
                thinking_text = block.get("thinking", "")
                if thinking_text:
                    await ws_manager.broadcast_event(
                        session_id,
                        {
                            "type": WsEventType.THINKING,
                            "text": thinking_text,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        },
                    )
            elif block.get("type") == "text":
                turn_state["text"] = block.get("text", "")
                has_new_text = True
            elif block.get("type") == "tool_use":
                tool_name = block.get("name", "unknown")
                tool_input = block.get("input", {})
                tool_use_id = block.get("id", "")

                # AskUserQuestion 감지: 인터랙티브 질문 이벤트로 변환
                # 사용자 응답을 기다리기 위해 subprocess 종료를 요청
                if tool_name == "AskUserQuestion":
                    turn_state["ask_user_question_tool_id"] = tool_use_id
                    turn_state["should_terminate"] = True
                    await ws_manager.broadcast_event(
                        session_id,
                        {
                            "type": WsEventType.ASK_USER_QUESTION,
                            "questions": tool_input.get("questions", []),
                            "tool_use_id": tool_use_id,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        },
                    )
                    continue

                # ExitPlanMode 감지: 상세 플랜을 turn_state에 캡처하고
                # 일반 tool_use 브로드캐스트를 건너뜀 (Plan 완료 시 아티팩트에 사용)
                if tool_name == "ExitPlanMode":
                    plan_content = tool_input.get("plan", "")
                    allowed_prompts = tool_input.get("allowedPrompts", [])
                    if plan_content:
                        turn_state["exit_plan_content"] = plan_content
                        turn_state["exit_plan_allowed_prompts"] = allowed_prompts
                    turn_state["exit_plan_tool_id"] = tool_use_id
                    continue

                tool_event = {
                    "type": WsEventType.TOOL_USE,
                    "tool": tool_name,
                    "input": tool_input,
                    "tool_use_id": tool_use_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                await ws_manager.broadcast_event(session_id, tool_event)

                # tool_use를 messages 테이블에 저장 (히스토리 복원용)
                await session_manager.add_message(
                    session_id=session_id,
                    role="assistant",
                    content="",
                    timestamp=utc_now(),
                    message_type="tool_use",
                    tool_use_id=tool_use_id,
                    tool_name=tool_name,
                    tool_input=tool_input,
                )

                if tool_name in ("Write", "Edit", "MultiEdit"):
                    raw_path = tool_input.get(
                        "file_path", tool_input.get("path", "unknown")
                    )
                    work_dir = turn_state.get("work_dir", "")
                    wt_name = turn_state.get("worktree_name")
                    file_path = (
                        self._normalize_file_path(raw_path, work_dir, wt_name)
                        if work_dir
                        else raw_path
                    )
                    ts_dt = utc_now()
                    await session_manager.add_file_change(
                        session_id, tool_name, file_path, ts_dt
                    )
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

        if has_new_text and turn_state["text"]:
            await ws_manager.broadcast_event(
                session_id,
                {
                    "type": WsEventType.ASSISTANT_TEXT,
                    "text": turn_state["text"],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )

            # 리드 세션 @delegate 패턴 자동 위임
            try:
                from app.api.dependencies import get_team_coordinator

                coordinator = get_team_coordinator()
                commands = coordinator.parse_delegate_commands(turn_state["text"])
                if commands:
                    # session_id → 태스크 역조회 → 리드 여부 확인
                    from app.repositories.team_repo import TeamRepository
                    from app.repositories.team_task_repo import TeamTaskRepository

                    async with coordinator._db.session() as db_sess:
                        task_repo = TeamTaskRepository(db_sess)
                        tasks = await task_repo.get_tasks_by_session_id(session_id)
                        team_repo = TeamRepository(db_sess)
                        for task in tasks:
                            team = await team_repo.get_by_id(task.team_id)
                            if team and team.lead_member_id == task.assigned_member_id:
                                for nickname, desc in commands:
                                    asyncio.create_task(
                                        coordinator.auto_delegate(
                                            team.id, nickname, desc
                                        )
                                    )
            except Exception:
                logger.debug("세션 %s: TeamCoordinator @delegate 처리 실패 (미초기화)", session_id)

    async def _handle_user_event(
        self,
        event: dict,
        session_id: str,
        ws_manager: WebSocketManager,
        session_manager: SessionManager,
        turn_state: dict,
    ) -> None:
        """user 타입 이벤트 (tool_result) 처리."""
        msg = event.get("message", {})
        content_blocks = msg.get("content", [])
        for block in content_blocks:
            if block.get("type") == "tool_result":
                tool_use_id = block.get("tool_use_id", "")

                # AskUserQuestion의 tool_result는 프론트엔드에 전송하지 않음
                if tool_use_id == turn_state.get("ask_user_question_tool_id"):
                    turn_state.pop("ask_user_question_tool_id", None)
                    continue

                # ExitPlanMode의 tool_result도 프론트엔드에 전송하지 않음
                if tool_use_id == turn_state.get("exit_plan_tool_id"):
                    turn_state.pop("exit_plan_tool_id", None)
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
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )

                # tool_result를 messages 테이블에 저장 (히스토리 복원용)
                await session_manager.add_message(
                    session_id=session_id,
                    role="tool",
                    content=result_info["output"],
                    timestamp=utc_now(),
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
        turn_state: dict,
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

        turn_state["result_received"] = True
        turn_state["result_text"] = result_text  # finally 블록에서 사용

        result_event = {
            "type": WsEventType.RESULT,
            "text": result_text,
            "is_error": is_error,
            "cost": cost_info,
            "duration_ms": duration,
            "session_id": session_id_from_result,
            "workflow_phase": turn_state.get("workflow_phase"),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cache_creation_tokens": cache_creation_tokens,
            "cache_read_tokens": cache_read_tokens,
            "model": model,
            "timestamp": datetime.now(timezone.utc).isoformat(),
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

    @staticmethod
    def create_turn_state(
        work_dir: str = "",
        worktree_name: str | None = None,
        workflow_phase: str | None = None,
    ) -> dict:
        """turn_state 딕셔너리를 생성.

        turn_state는 현재 턴의 공유 상태로, 아래 키를 포함합니다:
          text (str): 누적 응답 텍스트
          model (str|None): 응답 모델명
          work_dir (str): 작업 디렉토리 (파일 경로 정규화용)
          worktree_name (str|None): 워크트리 이름 (claude -w 세션용)
          workflow_phase (str|None): 워크플로우 phase ("research"|"plan"|"implement"|None)
          result_received (bool): result 이벤트 수신 여부 (비정상 종료 감지용)
          should_terminate (bool, 동적): AskUserQuestion 감지 시 True, 스트림 파싱 중단
        """
        return {
            "text": "",
            "model": None,
            "work_dir": work_dir,
            "worktree_name": worktree_name,
            "workflow_phase": workflow_phase,
            "result_received": False,
        }

    async def _parse_stream(
        self,
        process,
        session_id: str,
        ws_manager: WebSocketManager,
        session_manager: SessionManager,
        turn_state: dict,
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
            if turn_state.get("should_terminate"):
                break

    @staticmethod
    def _cleanup_mcp_config(mcp_config_path: Path | None) -> None:
        """MCP config 임시 파일 정리."""
        if mcp_config_path and mcp_config_path.exists():
            try:
                mcp_config_path.unlink()
            except OSError:
                logger.debug("MCP config 정리 실패: %s", mcp_config_path, exc_info=True)

    async def run(
        self,
        session: dict,
        prompt: str,
        allowed_tools: str,
        session_id: str,
        ws_manager: WebSocketManager,
        session_manager: SessionManager,
        images: list[str] | None = None,
        mcp_service=None,
        workflow_phase: str | None = None,
        workflow_service=None,
        original_prompt: str | None = None,
    ):
        """Claude CLI 실행 및 스트림 처리 오케스트레이션."""
        await session_manager.update_status(session_id, SessionStatus.RUNNING)
        await ws_manager.broadcast_event(
            session_id, {"type": WsEventType.STATUS, "status": SessionStatus.RUNNING}
        )

        # _build_command는 동기 메서드 (내부에서 _copy_images_to_workdir의 shutil.copy2 등
        # 블로킹 I/O를 수행하므로 이벤트 루프 보호를 위해 스레드에서 실행)
        cmd, _, mcp_config_path = await asyncio.to_thread(
            self._build_command,
            session,
            prompt,
            allowed_tools,
            session_id,
            images,
            workflow_phase,
        )

        # MCP config 통합: 사용자 MCP 서버 + Permission MCP 병합
        mcp_config_path = await self._setup_mcp_config(
            session, session_id, cmd, mcp_service
        )
        timeout_seconds = session.get("timeout_seconds")

        work_dir = session.get("work_dir", "")
        worktree_name = session.get("worktree_name")
        turn_state = self.create_turn_state(
            work_dir=work_dir,
            worktree_name=worktree_name,
            workflow_phase=workflow_phase,
        )

        try:
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
                    process.terminate()
                    try:
                        await asyncio.wait_for(process.wait(), timeout=5)
                    except asyncio.TimeoutError:
                        process.kill()
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

            # AskUserQuestion으로 인한 조기 중단: subprocess 종료
            if turn_state and turn_state.get("should_terminate"):
                logger.info(
                    "세션 %s: AskUserQuestion 감지 — 사용자 응답 대기를 위해 프로세스 종료",
                    session_id,
                )
                process.terminate()
                try:
                    await asyncio.wait_for(process.wait(), timeout=5)
                except asyncio.TimeoutError:
                    process.kill()
            else:
                # 정상 흐름: stderr 읽기와 프로세스 대기를 병렬 실행
                async def _read_stderr():
                    try:
                        stderr = await asyncio.wait_for(
                            process.stderr.read(), timeout=10
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
                            "세션 %s: stderr 읽기 타임아웃 (10초)", session_id
                        )

                async def _wait_process():
                    try:
                        await asyncio.wait_for(process.wait(), timeout=10)
                    except asyncio.TimeoutError:
                        logger.warning(
                            "세션 %s: 프로세스 종료 대기 타임아웃 — 강제 종료",
                            session_id,
                        )
                        process.kill()

                await asyncio.gather(_read_stderr(), _wait_process())

        except Exception as e:
            error_msg = str(e) or f"{type(e).__name__}: (no message)"
            logger.error("세션 %s 실행 오류: %s", session_id, error_msg, exc_info=True)
            await session_manager.update_status(session_id, SessionStatus.ERROR)
            await ws_manager.broadcast_event(
                session_id, {"type": WsEventType.ERROR, "message": error_msg}
            )

        finally:
            # 비정상 종료 시 스트리밍 중이던 텍스트를 DB에 저장 (데이터 유실 방지)
            # result 이벤트가 수신되지 않았고, 누적된 텍스트가 있는 경우에만
            if (
                turn_state.get("text")
                and not turn_state.get("result_received")
                and not turn_state.get("should_terminate")
            ):
                logger.info(
                    "세션 %s: result 미수신 상태에서 종료 — partial text 저장 (%d자)",
                    session_id,
                    len(turn_state["text"]),
                )
                try:
                    await session_manager.add_message(
                        session_id=session_id,
                        role="assistant",
                        content=turn_state["text"],
                        timestamp=utc_now(),
                        is_error=False,
                        model=turn_state.get("model"),
                    )
                except Exception:
                    logger.warning(
                        "세션 %s: partial text DB 저장 실패", session_id, exc_info=True
                    )

            # ERROR 상태인 경우 보존, 그 외에는 IDLE로 전환
            current_session = await session_manager.get(session_id)
            current_status = current_session.get("status") if current_session else None
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
            # 턴 완료 후: DB flush 보장 → 인메모리 이벤트 버퍼 정리
            await ws_manager.flush_events()
            ws_manager.clear_buffer(session_id)
            self._cleanup_mcp_config(mcp_config_path)

            # 워크플로우: research 완료 → 아티팩트 저장 + Plan 자동 체이닝
            if (
                workflow_phase == "research"
                and workflow_service
                and turn_state.get("result_received")
            ):
                result_text = turn_state.get("text", "")
                if result_text:
                    try:
                        # 1) Research 아티팩트 저장
                        await workflow_service.create_artifact(
                            session_id=session_id,
                            phase="research",
                            content=result_text,
                        )
                        # 2) Research 자동 승인 + Plan 전환
                        await workflow_service.approve_phase(
                            session_id, session_manager=session_manager
                        )
                        await ws_manager.broadcast_event(
                            session_id,
                            {
                                "type": WsEventType.WORKFLOW_PHASE_APPROVED,
                                "phase": "research",
                                "next_phase": "plan",
                            },
                        )
                        await ws_manager.broadcast_event(
                            session_id,
                            {
                                "type": WsEventType.WORKFLOW_AUTO_CHAIN,
                                "from_phase": "research",
                                "to_phase": "plan",
                            },
                        )
                        # 3) Plan 자동 실행
                        raw_prompt = original_prompt or prompt
                        plan_context = await workflow_service.build_phase_context(
                            session_id, "plan", raw_prompt
                        )
                        updated = await session_manager.get(session_id)
                        plan_task = asyncio.create_task(
                            self.run(
                                updated,
                                plan_context,
                                allowed_tools,
                                session_id,
                                ws_manager,
                                session_manager,
                                mcp_service=mcp_service,
                                workflow_phase="plan",
                                workflow_service=workflow_service,
                                original_prompt=raw_prompt,
                            )
                        )
                        plan_task.add_done_callback(
                            lambda t: _auto_chain_done(
                                t, session_id, session_manager
                            )
                        )
                        session_manager.set_runner_task(session_id, plan_task)
                    except Exception:
                        logger.warning(
                            "세션 %s: Research→Plan 자동 체이닝 실패",
                            session_id,
                            exc_info=True,
                        )

            # 워크플로우: plan 완료 → 아티팩트 저장 + awaiting_approval
            elif (
                workflow_phase == "plan"
                and workflow_service
                and turn_state.get("result_received")
            ):
                # ExitPlanMode의 상세 플랜이 있으면 우선 사용, 없으면 result_text 폴백
                result_text = (
                    turn_state.get("exit_plan_content")
                    or turn_state.get("result_text")
                    or turn_state.get("text", "")
                )
                if result_text:
                    try:
                        await workflow_service.create_artifact(
                            session_id=session_id,
                            phase="plan",
                            content=result_text,
                        )
                        await session_manager.update_settings(
                            session_id, workflow_phase_status="awaiting_approval"
                        )
                        await ws_manager.broadcast_event(
                            session_id,
                            {
                                "type": WsEventType.WORKFLOW_PHASE_COMPLETED,
                                "phase": "plan",
                            },
                        )
                    except Exception:
                        logger.warning(
                            "세션 %s: Plan 아티팩트 저장 실패",
                            session_id,
                            exc_info=True,
                        )

            # 워크플로우: implement 완료 → 아티팩트 저장 + 워크플로우 종료
            elif (
                workflow_phase == "implement"
                and workflow_service
                and turn_state.get("result_received")
            ):
                result_text = turn_state.get("result_text") or turn_state.get("text", "")
                if result_text:
                    try:
                        await workflow_service.create_artifact(
                            session_id=session_id,
                            phase="implement",
                            content=result_text,
                        )
                    except Exception:
                        logger.warning(
                            "세션 %s: Implement 아티팩트 저장 실패",
                            session_id,
                            exc_info=True,
                        )
                try:
                    await session_manager.update_settings(
                        session_id,
                        workflow_phase=None,
                        workflow_phase_status=None,
                    )

                    # 커밋 메시지 자동 생성
                    commit_suggestion = None
                    try:
                        suggestion = await workflow_service.generate_commit_suggestion(
                            session_id
                        )
                        commit_suggestion = suggestion
                    except Exception:
                        logger.warning(
                            "세션 %s: 커밋 메시지 자동 생성 실패",
                            session_id,
                            exc_info=True,
                        )

                    event_payload: dict = {"type": WsEventType.WORKFLOW_COMPLETED}
                    if commit_suggestion:
                        event_payload["commit_suggestion"] = commit_suggestion

                    await ws_manager.broadcast_event(session_id, event_payload)
                    logger.info("워크플로우 완료: session=%s", session_id)
                except Exception:
                    logger.warning(
                        "세션 %s: 워크플로우 완료 처리 실패",
                        session_id,
                        exc_info=True,
                    )

            # 팀 코디네이터 콜백: 세션 완료 시 팀 태스크 자동 완료
            try:
                from app.api.dependencies import get_team_coordinator

                coordinator = get_team_coordinator()
                last_text = turn_state.get("text") if turn_state else None
                await coordinator.on_session_completed(session_id, last_text)
            except Exception as e:
                # TeamCoordinator 미초기화 또는 오류 시 무시
                if "초기화되지 않았습니다" not in str(e):
                    logger.warning("세션 %s: 팀 콜백 실패: %s", session_id, e)
