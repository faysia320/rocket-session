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

    def __init__(self, settings: Settings):
        self._settings = settings

    @staticmethod
    def _copy_images_to_workdir(
        images: list[str], work_dir: str
    ) -> list[str]:
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

        # Plan 모드: 시스템 프롬프트 주입 + 읽기 전용 도구로 제한
        if mode == "plan":
            plan_instruction = (
                "You are in PLAN mode. Analyze the request and create a detailed plan. "
                "Do NOT make any file changes. Do NOT use Write, Edit, or MultiEdit tools. "
                "Only explain step by step what changes would be needed and why."
            )
            if system_prompt:
                system_prompt = f"{plan_instruction}\n\n{system_prompt}"
            else:
                system_prompt = plan_instruction
            allowed_tools = "Read,Glob,Grep,WebFetch,WebSearch,TodoRead"

        # Permission 모드: MCP config 및 --permission-prompt-tool 설정
        if session.get("permission_mode"):
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
        if self._settings.claude_model:
            cmd.extend(["--model", self._settings.claude_model])
        if system_prompt:
            cmd.extend(["--system-prompt", system_prompt])

        claude_session_id = session.get("claude_session_id")
        if claude_session_id:
            cmd.extend(["--resume", claude_session_id])

        # 이미지 파일: 작업 디렉토리에 복사 후 프롬프트에 참조 삽입
        if images:
            work_dir = session.get("work_dir", "")
            copied_paths = self._copy_images_to_workdir(images, work_dir)
            if copied_paths:
                image_refs = "\n".join(f"- {p}" for p in copied_paths)
                image_instruction = (
                    f"\n\n[첨부된 이미지 파일입니다. Read 도구로 확인하세요:\n{image_refs}\n]"
                )
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
        )

    async def _handle_stream_event(
        self,
        event: dict,
        session_id: str,
        mode: str,
        ws_manager: WebSocketManager,
        session_manager: SessionManager,
        current_text_holder: list[str],
    ) -> None:
        """파싱된 JSON 이벤트를 타입별로 처리."""
        event_type = event.get("type", "")

        if event_type == "system" and event.get("session_id"):
            await session_manager.update_claude_session_id(
                session_id, event["session_id"]
            )
            await ws_manager.broadcast_event(
                session_id,
                {"type": "session_info", "claude_session_id": event["session_id"]},
            )

        elif event_type == "assistant":
            await self._handle_assistant_event(
                event, session_id, ws_manager, session_manager, current_text_holder
            )

        elif event_type == "user":
            await self._handle_user_event(event, session_id, ws_manager)

        elif event_type == "result":
            await self._handle_result_event(
                event, session_id, mode, ws_manager, session_manager,
                current_text_holder,
            )

        else:
            await ws_manager.broadcast_event(session_id, {"type": "event", "event": event})

    async def _handle_assistant_event(
        self,
        event: dict,
        session_id: str,
        ws_manager: WebSocketManager,
        session_manager: SessionManager,
        current_text_holder: list[str],
    ) -> None:
        """assistant 타입 이벤트 처리."""
        msg = event.get("message", {})
        content_blocks = msg.get("content", [])
        has_new_text = False
        for block in content_blocks:
            if block.get("type") == "text":
                current_text_holder[0] = block.get("text", "")
                has_new_text = True
            elif block.get("type") == "tool_use":
                tool_name = block.get("name", "unknown")
                tool_input = block.get("input", {})
                tool_use_id = block.get("id", "")
                tool_event = {
                    "type": "tool_use",
                    "tool": tool_name,
                    "input": tool_input,
                    "tool_use_id": tool_use_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                await ws_manager.broadcast_event(session_id, tool_event)

                if tool_name in ("Write", "Edit", "MultiEdit"):
                    file_path = tool_input.get(
                        "file_path", tool_input.get("path", "unknown")
                    )
                    ts = datetime.now(timezone.utc).isoformat()
                    await session_manager.add_file_change(
                        session_id, tool_name, file_path, ts
                    )
                    await ws_manager.broadcast_event(
                        session_id,
                        {
                            "type": "file_change",
                            "change": {
                                "tool": tool_name,
                                "file": file_path,
                                "timestamp": ts,
                            },
                        },
                    )

        if has_new_text and current_text_holder[0]:
            await ws_manager.broadcast_event(
                session_id,
                {
                    "type": "assistant_text",
                    "text": current_text_holder[0],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )

    async def _handle_user_event(
        self, event: dict, session_id: str, ws_manager: WebSocketManager
    ) -> None:
        """user 타입 이벤트 (tool_result) 처리."""
        msg = event.get("message", {})
        content_blocks = msg.get("content", [])
        for block in content_blocks:
            if block.get("type") == "tool_result":
                tool_use_id = block.get("tool_use_id", "")
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
                truncated = full_length > 5000
                await ws_manager.broadcast_event(
                    session_id,
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_use_id,
                        "output": output_text[:5000],
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
        current_text_holder: list[str],
    ) -> None:
        """result 타입 이벤트 처리."""
        result_text = event.get("result") or ""
        # result 텍스트가 비어있으면 스트리밍된 텍스트를 폴백으로 사용
        if not result_text and current_text_holder:
            result_text = current_text_holder[0]
        cost_info = event.get("cost_usd", event.get("cost", None))
        duration = event.get("duration_ms", None)
        session_id_from_result = event.get("session_id", None)

        if session_id_from_result:
            await session_manager.update_claude_session_id(
                session_id, session_id_from_result
            )

        result_event = {
            "type": "result",
            "text": result_text,
            "cost": cost_info,
            "duration_ms": duration,
            "session_id": session_id_from_result,
            "mode": mode,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await ws_manager.broadcast_event(session_id, result_event)

        await session_manager.add_message(
            session_id=session_id,
            role="assistant",
            content=result_text,
            timestamp=datetime.now(timezone.utc).isoformat(),
            cost=cost_info,
            duration_ms=duration,
        )

    async def _parse_stream(
        self,
        process,
        session_id: str,
        mode: str,
        ws_manager: WebSocketManager,
        session_manager: SessionManager,
    ) -> None:
        """subprocess stdout에서 JSON 스트림을 읽고 이벤트별로 처리."""
        current_text_holder = [""]

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
                    session_id, {"type": "raw", "text": line_str}
                )
                continue

            await self._handle_stream_event(
                event,
                session_id,
                mode,
                ws_manager,
                session_manager,
                current_text_holder,
            )

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
            session_id, {"type": "status", "status": SessionStatus.RUNNING}
        )

        cmd, _, mcp_config_path = self._build_command(
            session, prompt, allowed_tools, session_id, mode, images=images
        )
        timeout_seconds = session.get("timeout_seconds")

        try:
            process = await self._start_process(cmd, session["work_dir"])
            session_manager.set_process(session_id, process)

            # 타임아웃 적용
            if timeout_seconds and timeout_seconds > 0:
                try:
                    await asyncio.wait_for(
                        self._parse_stream(
                            process, session_id, mode, ws_manager, session_manager
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
                            "type": "error",
                            "message": f"프로세스 타임아웃 ({timeout_seconds}초) 초과로 종료되었습니다.",
                        },
                    )
            else:
                await self._parse_stream(
                    process, session_id, mode, ws_manager, session_manager
                )

            stderr = await process.stderr.read()
            if stderr:
                stderr_text = stderr.decode("utf-8").strip()
                if stderr_text:
                    await ws_manager.broadcast_event(
                        session_id, {"type": "stderr", "text": stderr_text}
                    )

            await process.wait()

        except Exception as e:
            error_msg = str(e) or f"{type(e).__name__}: (no message)"
            logger.error("세션 %s 실행 오류: %s", session_id, error_msg, exc_info=True)
            await session_manager.update_status(session_id, SessionStatus.ERROR)
            await ws_manager.broadcast_event(
                session_id, {"type": "error", "message": error_msg}
            )

        finally:
            await session_manager.update_status(session_id, SessionStatus.IDLE)
            session_manager.clear_process(session_id)
            await ws_manager.broadcast_event(
                session_id, {"type": "status", "status": SessionStatus.IDLE}
            )
            self._cleanup_mcp_config(mcp_config_path)
