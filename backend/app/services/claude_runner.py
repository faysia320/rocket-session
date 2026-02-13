"""Claude Code CLI subprocess 실행 및 스트림 파싱."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import TYPE_CHECKING

from app.core.config import Settings
from app.services.websocket_manager import WebSocketManager

if TYPE_CHECKING:
    from app.services.session_manager import SessionManager

logger = logging.getLogger(__name__)


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
    ):
        await session_manager.update_status(session_id, "running")
        await ws_manager.broadcast(session_id, {"type": "status", "status": "running"})

        cmd = ["claude", "-p", prompt, "--output-format", "stream-json"]

        if allowed_tools:
            cmd.extend(["--allowedTools", allowed_tools])

        if self._settings.claude_model:
            cmd.extend(["--model", self._settings.claude_model])

        # 시스템 프롬프트 지원
        system_prompt = session.get("system_prompt")
        if system_prompt:
            cmd.extend(["--system-prompt", system_prompt])

        claude_session_id = session.get("claude_session_id")
        if claude_session_id:
            cmd.extend(["--resume", claude_session_id])

        # 타임아웃 설정
        timeout_seconds = session.get("timeout_seconds")

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=session["work_dir"],
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
                                tool_event = {
                                    "type": "tool_use",
                                    "tool": tool_name,
                                    "input": tool_input,
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
            await session_manager.update_status(session_id, "error")
            await ws_manager.broadcast(
                session_id, {"type": "error", "message": str(e)}
            )

        finally:
            await session_manager.update_status(session_id, "idle")
            session_manager.clear_process(session_id)
            await ws_manager.broadcast(
                session_id, {"type": "status", "status": "idle"}
            )
