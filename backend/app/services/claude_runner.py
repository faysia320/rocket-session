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
from app.models.event_types import CliEventType, WsEventType
from app.models.session import SessionStatus
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
        mode: str,
        images: list[str] | None = None,
    ) -> tuple[list[str], str | None, Path | None]:
        """CLI 커맨드를 구성하고, (cmd, system_prompt, mcp_config_path)를 반환."""
        cmd = ["claude", "-p", prompt, "--output-format", "stream-json", "--verbose"]
        system_prompt = session.get("system_prompt")
        mcp_config_path = None

        # Plan 모드: CLI 네이티브 plan mode + 시스템 프롬프트 + 읽기 전용 도구 제한
        if mode == "plan":
            cmd.extend(["--permission-mode", "plan"])
            plan_instruction = (
                "Create a detailed plan for the request. "
                "Explain step by step what changes would be needed and why. "
                "Do NOT execute the plan or make any changes. "
                "Do NOT call ExitPlanMode. Present the plan for user review only."
            )
            if system_prompt:
                system_prompt = f"{plan_instruction}\n\n{system_prompt}"
            else:
                system_prompt = plan_instruction
            allowed_tools = "Read,Glob,Grep,WebFetch,WebSearch,TodoRead"

        # Permission 모드: plan mode와 상호 배타 (--permission-mode 하나만 가능)
        elif session.get("permission_mode"):
            mcp_config_path = self._setup_permission_mcp(session, session_id, cmd)

            # permission_required_tools에 해당하는 도구는 allowedTools에서 제외
            perm_tools_raw = session.get("permission_required_tools")
            if perm_tools_raw and allowed_tools:
                try:
                    required = (
                        json.loads(perm_tools_raw)
                        if isinstance(perm_tools_raw, str)
                        else perm_tools_raw
                    )
                except (json.JSONDecodeError, TypeError):
                    required = []
                if required:
                    tool_list = [t.strip() for t in allowed_tools.split(",")]
                    allowed_tools = ",".join(t for t in tool_list if t not in required)

        if allowed_tools:
            cmd.extend(["--allowedTools", allowed_tools])

        model = session.get("model")
        if model:
            cmd.extend(["--model", model])

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

    def _setup_permission_mcp(
        self, session: dict, session_id: str, cmd: list[str]
    ) -> Path:
        """Permission MCP 서버 설정을 생성하고 커맨드에 추가."""
        mcp_server_script = str(Path(__file__).parent / "permission_mcp_server.py")
        mcp_config = {
            "mcpServers": {
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
        }
        mcp_config_path = Path(tempfile.gettempdir()) / f"mcp-perm-{session_id}.json"
        mcp_config_path.write_text(json.dumps(mcp_config), encoding="utf-8")
        cmd.extend(["--mcp-config", str(mcp_config_path)])
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
    def _normalize_file_path(file_path: str, work_dir: str) -> str:
        """파일 경로를 work_dir 기준 상대 경로로 정규화한다.

        CLI가 절대 경로를 반환하는 경우, work_dir 하위이면 상대 경로로 변환한다.
        """
        p = Path(file_path)
        if p.is_absolute():
            try:
                return str(p.resolve().relative_to(Path(work_dir).resolve()))
            except ValueError:
                # work_dir 외부 경로는 그대로 반환
                return file_path
        return file_path

    async def _handle_stream_event(
        self,
        event: dict,
        session_id: str,
        mode: str,
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
            await self._handle_user_event(event, session_id, ws_manager, turn_state)

        elif event_type == CliEventType.RESULT:
            await self._handle_result_event(
                event,
                session_id,
                mode,
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

                # ExitPlanMode 감지: 모드 전환 이벤트로 변환
                if tool_name == "ExitPlanMode":
                    turn_state["exit_plan_tool_id"] = tool_use_id
                    turn_state["mode"] = "normal"
                    await session_manager.update_settings(session_id, mode="normal")
                    await ws_manager.broadcast_event(
                        session_id,
                        {
                            "type": WsEventType.MODE_CHANGE,
                            "from_mode": "plan",
                            "to_mode": "normal",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        },
                    )
                    continue

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

                tool_event = {
                    "type": WsEventType.TOOL_USE,
                    "tool": tool_name,
                    "input": tool_input,
                    "tool_use_id": tool_use_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                await ws_manager.broadcast_event(session_id, tool_event)

                if tool_name in ("Write", "Edit", "MultiEdit"):
                    raw_path = tool_input.get(
                        "file_path", tool_input.get("path", "unknown")
                    )
                    work_dir = turn_state.get("work_dir", "")
                    file_path = (
                        self._normalize_file_path(raw_path, work_dir)
                        if work_dir
                        else raw_path
                    )
                    ts = datetime.now(timezone.utc).isoformat()
                    await session_manager.add_file_change(
                        session_id, tool_name, file_path, ts
                    )
                    await ws_manager.broadcast_event(
                        session_id,
                        {
                            "type": WsEventType.FILE_CHANGE,
                            "change": {
                                "tool": tool_name,
                                "file": file_path,
                                "timestamp": ts,
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

    async def _handle_user_event(
        self,
        event: dict,
        session_id: str,
        ws_manager: WebSocketManager,
        turn_state: dict,
    ) -> None:
        """user 타입 이벤트 (tool_result) 처리."""
        msg = event.get("message", {})
        content_blocks = msg.get("content", [])
        for block in content_blocks:
            if block.get("type") == "tool_result":
                tool_use_id = block.get("tool_use_id", "")

                # ExitPlanMode의 tool_result는 프론트엔드에 전송하지 않음
                if tool_use_id == turn_state.get("exit_plan_tool_id"):
                    turn_state.pop("exit_plan_tool_id", None)
                    continue

                # AskUserQuestion의 tool_result는 프론트엔드에 전송하지 않음
                if tool_use_id == turn_state.get("ask_user_question_tool_id"):
                    turn_state.pop("ask_user_question_tool_id", None)
                    continue

                raw_content = block.get("content", "")
                if isinstance(raw_content, list):
                    output_text = "\n".join(
                        item.get("text", "")
                        for item in raw_content
                        if item.get("type") == "text"
                    )
                else:
                    output_text = str(raw_content)
                full_length = len(output_text)
                truncated = full_length > self._MAX_TOOL_OUTPUT_LENGTH
                await ws_manager.broadcast_event(
                    session_id,
                    {
                        "type": WsEventType.TOOL_RESULT,
                        "tool_use_id": tool_use_id,
                        "output": output_text[: self._MAX_TOOL_OUTPUT_LENGTH],
                        "is_error": block.get("is_error", False),
                        "is_truncated": truncated,
                        "full_length": full_length if truncated else None,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )

    async def _handle_result_event(
        self,
        event: dict,
        session_id: str,
        mode: str,
        ws_manager: WebSocketManager,
        session_manager: SessionManager,
        turn_state: dict,
    ) -> None:
        """result 타입 이벤트 처리."""
        result_text = event.get("result") or ""
        # result 텍스트가 비어있으면 스트리밍된 텍스트를 폴백으로 사용
        if not result_text and turn_state.get("text"):
            result_text = turn_state["text"]
        is_error = event.get("is_error", False)
        cost_info = event.get("cost_usd", event.get("cost", None))
        duration = event.get("duration_ms", None)
        session_id_from_result = event.get("session_id", None)

        # 토큰 사용량 추출
        usage = event.get("usage", {})
        input_tokens = usage.get("input_tokens")
        output_tokens = usage.get("output_tokens")
        cache_creation_tokens = usage.get("cache_creation_input_tokens")
        cache_read_tokens = usage.get("cache_read_input_tokens")
        model = turn_state.get("model")

        if session_id_from_result:
            await session_manager.update_claude_session_id(
                session_id, session_id_from_result
            )

        result_event = {
            "type": WsEventType.RESULT,
            "text": result_text,
            "is_error": is_error,
            "cost": cost_info,
            "duration_ms": duration,
            "session_id": session_id_from_result,
            "mode": mode,  # 원래 요청 mode 사용 (ExitPlanMode가 turn_state를 먼저 변경하므로)
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
            timestamp=datetime.now(timezone.utc).isoformat(),
            cost=cost_info,
            duration_ms=duration,
            is_error=is_error,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_creation_tokens=cache_creation_tokens,
            cache_read_tokens=cache_read_tokens,
            model=model,
        )

    async def _parse_stream(
        self,
        process,
        session_id: str,
        mode: str,
        ws_manager: WebSocketManager,
        session_manager: SessionManager,
        work_dir: str = "",
    ) -> dict:
        """subprocess stdout에서 JSON 스트림을 읽고 이벤트별로 처리.

        Returns:
            turn_state dict. should_terminate 키가 True이면 AskUserQuestion으로
            인한 조기 중단을 의미.
        """
        # turn_state: 현재 턴의 공유 상태
        #   text (str): 누적 응답 텍스트
        #   model (str|None): 응답 모델명
        #   work_dir (str): 작업 디렉토리 (파일 경로 정규화용)
        #   mode (str): 현재 모드 ("normal"|"plan"), ExitPlanMode 시 "normal"로 변경
        #   exit_plan_tool_id (str, 동적): ExitPlanMode tool_use_id, tool_result 필터링 후 제거
        #   should_terminate (bool, 동적): AskUserQuestion 감지 시 True, 스트림 파싱 중단
        turn_state = {"text": "", "model": None, "work_dir": work_dir, "mode": mode}

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
                mode,
                ws_manager,
                session_manager,
                turn_state,
            )

            # AskUserQuestion 감지 시 스트림 파싱 중단 (caller에서 프로세스 종료)
            if turn_state.get("should_terminate"):
                break

        return turn_state

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
        mode: str = "normal",
        images: list[str] | None = None,
    ):
        """Claude CLI 실행 및 스트림 처리 오케스트레이션."""
        await session_manager.update_status(session_id, SessionStatus.RUNNING)
        await ws_manager.broadcast_event(
            session_id, {"type": WsEventType.STATUS, "status": SessionStatus.RUNNING}
        )

        cmd, _, mcp_config_path = self._build_command(
            session, prompt, allowed_tools, session_id, mode, images=images
        )
        timeout_seconds = session.get("timeout_seconds")

        try:
            process = await self._start_process(cmd, session["work_dir"])
            session_manager.set_process(session_id, process)

            work_dir = session.get("work_dir", "")
            turn_state: dict | None = None

            # 타임아웃 적용
            if timeout_seconds and timeout_seconds > 0:
                try:
                    turn_state = await asyncio.wait_for(
                        self._parse_stream(
                            process,
                            session_id,
                            mode,
                            ws_manager,
                            session_manager,
                            work_dir=work_dir,
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
                turn_state = await self._parse_stream(
                    process,
                    session_id,
                    mode,
                    ws_manager,
                    session_manager,
                    work_dir=work_dir,
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
                # 정상 흐름: stderr 읽기 및 프로세스 대기
                stderr = await process.stderr.read()
                if stderr:
                    stderr_text = stderr.decode("utf-8").strip()
                    if stderr_text:
                        await ws_manager.broadcast_event(
                            session_id,
                            {"type": WsEventType.STDERR, "text": stderr_text},
                        )
                await process.wait()

        except Exception as e:
            error_msg = str(e) or f"{type(e).__name__}: (no message)"
            logger.error("세션 %s 실행 오류: %s", session_id, error_msg, exc_info=True)
            await session_manager.update_status(session_id, SessionStatus.ERROR)
            await ws_manager.broadcast_event(
                session_id, {"type": WsEventType.ERROR, "message": error_msg}
            )

        finally:
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
