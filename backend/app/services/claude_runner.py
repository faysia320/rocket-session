"""Claude Code CLI subprocess 실행 및 스트림 파싱."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

from app.core.config import Settings
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

    async def run(
        self,
        session: dict,
        prompt: str,
        allowed_tools: str,
        session_id: str,
        ws_manager: WebSocketManager,
        session_manager: SessionManager,
        mode: str = "normal",
    ):
        await session_manager.update_status(session_id, "running")
        await ws_manager.broadcast(session_id, {"type": "status", "status": "running"})

        cmd = ["claude", "-p", prompt, "--output-format", "stream-json", "--verbose"]

        # 시스템 프롬프트 지원
        system_prompt = session.get("system_prompt")

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
        mcp_config_path = None
        if session.get("permission_mode"):
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

            # permission_required_tools에 해당하는 도구는 allowedTools에서 제외
            perm_tools_raw = session.get("permission_required_tools")
            if perm_tools_raw and allowed_tools:
                try:
                    required = json.loads(perm_tools_raw) if isinstance(perm_tools_raw, str) else perm_tools_raw
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

        # 타임아웃 설정
        timeout_seconds = session.get("timeout_seconds")

        try:
            # CLAUDECODE 환경변수 제거 (중첩 세션 방지)
            env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}

            if sys.platform == "win32":
                popen = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    cwd=session["work_dir"],
                    env=env,
                )
                process = _AsyncProcessWrapper(popen)
            else:
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=session["work_dir"],
                    env=env,
                )
            session_manager.set_process(session_id, process)

            current_text = ""

            async def _read_stream():
                nonlocal current_text
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
                        await ws_manager.broadcast(
                            session_id, {"type": "raw", "text": line_str}
                        )
                        continue

                    event_type = event.get("type", "")

                    if event_type == "system" and event.get("session_id"):
                        await session_manager.update_claude_session_id(
                            session_id, event["session_id"]
                        )
                        await ws_manager.broadcast(
                            session_id,
                            {
                                "type": "session_info",
                                "claude_session_id": event["session_id"],
                            },
                        )

                    elif event_type == "assistant":
                        msg = event.get("message", {})
                        content_blocks = msg.get("content", [])
                        for block in content_blocks:
                            if block.get("type") == "text":
                                current_text = block.get("text", "")
                            elif block.get("type") == "tool_use":
                                tool_name = block.get("name", "unknown")
                                tool_input = block.get("input", {})
                                tool_use_id = block.get("id", "")
                                tool_event = {
                                    "type": "tool_use",
                                    "tool": tool_name,
                                    "input": tool_input,
                                    "tool_use_id": tool_use_id,
                                    "timestamp": datetime.utcnow().isoformat(),
                                }
                                await ws_manager.broadcast(session_id, tool_event)

                                if tool_name in ("Write", "Edit", "MultiEdit"):
                                    file_path = tool_input.get(
                                        "file_path", tool_input.get("path", "unknown")
                                    )
                                    ts = datetime.utcnow().isoformat()
                                    await session_manager.add_file_change(
                                        session_id, tool_name, file_path, ts
                                    )
                                    await ws_manager.broadcast(
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

                        if current_text:
                            await ws_manager.broadcast(
                                session_id,
                                {
                                    "type": "assistant_text",
                                    "text": current_text,
                                    "timestamp": datetime.utcnow().isoformat(),
                                },
                            )

                    elif event_type == "user":
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
                                await ws_manager.broadcast(
                                    session_id,
                                    {
                                        "type": "tool_result",
                                        "tool_use_id": tool_use_id,
                                        "output": output_text[:5000],
                                        "is_error": block.get("is_error", False),
                                        "timestamp": datetime.utcnow().isoformat(),
                                    },
                                )

                    elif event_type == "result":
                        result_text = event.get("result", "")
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
                            "timestamp": datetime.utcnow().isoformat(),
                        }
                        await ws_manager.broadcast(session_id, result_event)

                        await session_manager.add_message(
                            session_id=session_id,
                            role="assistant",
                            content=result_text,
                            timestamp=datetime.utcnow().isoformat(),
                            cost=cost_info,
                            duration_ms=duration,
                        )

                    else:
                        await ws_manager.broadcast(
                            session_id, {"type": "event", "event": event}
                        )

            # 타임아웃 적용
            if timeout_seconds and timeout_seconds > 0:
                try:
                    await asyncio.wait_for(_read_stream(), timeout=timeout_seconds)
                except asyncio.TimeoutError:
                    logger.warning("세션 %s: 타임아웃 (%d초) 초과", session_id, timeout_seconds)
                    process.terminate()
                    try:
                        await asyncio.wait_for(process.wait(), timeout=5)
                    except asyncio.TimeoutError:
                        process.kill()
                    await ws_manager.broadcast(
                        session_id,
                        {
                            "type": "error",
                            "message": f"프로세스 타임아웃 ({timeout_seconds}초) 초과로 종료되었습니다.",
                        },
                    )
            else:
                await _read_stream()

            stderr = await process.stderr.read()
            if stderr:
                stderr_text = stderr.decode("utf-8").strip()
                if stderr_text:
                    await ws_manager.broadcast(
                        session_id, {"type": "stderr", "text": stderr_text}
                    )

            await process.wait()

        except Exception as e:
            error_msg = str(e) or f"{type(e).__name__}: (no message)"
            logger.error("세션 %s 실행 오류: %s", session_id, error_msg, exc_info=True)
            await session_manager.update_status(session_id, "error")
            await ws_manager.broadcast(
                session_id, {"type": "error", "message": error_msg}
            )

        finally:
            await session_manager.update_status(session_id, "idle")
            session_manager.clear_process(session_id)
            await ws_manager.broadcast(
                session_id, {"type": "status", "status": "idle"}
            )
            # MCP config 임시 파일 정리
            if mcp_config_path and mcp_config_path.exists():
                try:
                    mcp_config_path.unlink()
                except OSError:
                    pass
