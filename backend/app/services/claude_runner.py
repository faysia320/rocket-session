"""Claude Code CLI subprocess 실행 및 스트림 파싱."""

import asyncio
import json
from datetime import datetime

from app.core.config import Settings
from app.models.session import Session, SessionStatus
from app.services.websocket_manager import WebSocketManager


class ClaudeRunner:
    """Claude Code CLI를 subprocess로 실행하고 출력을 파싱하여 브로드캐스트."""

    def __init__(self, settings: Settings):
        self._settings = settings

    async def run(
        self,
        session: Session,
        prompt: str,
        allowed_tools: str,
        session_id: str,
        ws_manager: WebSocketManager,
    ):
        session.status = SessionStatus.RUNNING
        await ws_manager.broadcast(session_id, {"type": "status", "status": "running"})

        cmd = ["claude", "-p", prompt, "--output-format", "stream-json"]

        if allowed_tools:
            cmd.extend(["--allowedTools", allowed_tools])

        if self._settings.claude_model:
            cmd.extend(["--model", self._settings.claude_model])

        if session.claude_session_id:
            cmd.extend(["--resume", session.claude_session_id])

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=session.work_dir,
            )
            session.process = process

            current_text = ""

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
                    session.claude_session_id = event["session_id"]
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
                                change = {
                                    "tool": tool_name,
                                    "file": file_path,
                                    "timestamp": datetime.utcnow().isoformat(),
                                }
                                session.file_changes.append(change)
                                await ws_manager.broadcast(
                                    session_id,
                                    {"type": "file_change", "change": change},
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
                        session.claude_session_id = session_id_from_result

                    result_event = {
                        "type": "result",
                        "text": result_text,
                        "cost": cost_info,
                        "duration_ms": duration,
                        "session_id": session_id_from_result,
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                    await ws_manager.broadcast(session_id, result_event)

                    session.history.append(
                        {
                            "role": "assistant",
                            "content": result_text,
                            "cost": cost_info,
                            "duration_ms": duration,
                            "timestamp": datetime.utcnow().isoformat(),
                        }
                    )

                else:
                    await ws_manager.broadcast(
                        session_id, {"type": "event", "event": event}
                    )

            stderr = await process.stderr.read()
            if stderr:
                stderr_text = stderr.decode("utf-8").strip()
                if stderr_text:
                    await ws_manager.broadcast(
                        session_id, {"type": "stderr", "text": stderr_text}
                    )

            await process.wait()

        except Exception as e:
            session.status = SessionStatus.ERROR
            await ws_manager.broadcast(
                session_id, {"type": "error", "message": str(e)}
            )

        finally:
            session.status = SessionStatus.IDLE
            session.process = None
            await ws_manager.broadcast(
                session_id, {"type": "status", "status": "idle"}
            )
