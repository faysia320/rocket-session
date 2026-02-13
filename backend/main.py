"""
Claude Code Dashboard - FastAPI Backend
Manages Claude Code CLI subprocess and streams output via WebSocket.
"""

import asyncio
import json
import os
import signal
import uuid
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="Claude Code Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CLAUDE_WORK_DIR = os.getenv("CLAUDE_WORK_DIR", os.path.expanduser("~"))
CLAUDE_ALLOWED_TOOLS = os.getenv("CLAUDE_ALLOWED_TOOLS", "Read,Write,Edit,Bash")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "")

# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------


class SessionStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    ERROR = "error"


class Session:
    def __init__(self, session_id: str, work_dir: str):
        self.id = session_id
        self.claude_session_id: Optional[str] = None
        self.work_dir = work_dir
        self.status: SessionStatus = SessionStatus.IDLE
        self.history: list[dict] = []
        self.process: Optional[asyncio.subprocess.Process] = None
        self.created_at: str = datetime.utcnow().isoformat()
        self.file_changes: list[dict] = []


sessions: dict[str, Session] = {}
active_websockets: dict[str, list[WebSocket]] = {}  # session_id -> websockets

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class CreateSessionRequest(BaseModel):
    work_dir: Optional[str] = None


class SendPromptRequest(BaseModel):
    prompt: str
    allowed_tools: Optional[str] = None


class SessionInfo(BaseModel):
    id: str
    claude_session_id: Optional[str]
    work_dir: str
    status: str
    created_at: str
    message_count: int
    file_changes_count: int


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/api/sessions", response_model=SessionInfo)
async def create_session(req: CreateSessionRequest):
    sid = str(uuid.uuid4())[:8]
    work_dir = req.work_dir or CLAUDE_WORK_DIR
    session = Session(sid, work_dir)
    sessions[sid] = session
    return _session_info(session)


@app.get("/api/sessions")
async def list_sessions():
    return [_session_info(s) for s in sessions.values()]


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return _session_info(session)


@app.get("/api/sessions/{session_id}/history")
async def get_history(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session.history


@app.get("/api/sessions/{session_id}/files")
async def get_file_changes(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session.file_changes


@app.post("/api/sessions/{session_id}/stop")
async def stop_session(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    await _kill_process(session)
    return {"status": "stopped"}


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    await _kill_process(session)
    del sessions[session_id]
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# WebSocket endpoint – real-time streaming
# ---------------------------------------------------------------------------


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(ws: WebSocket, session_id: str):
    await ws.accept()

    session = sessions.get(session_id)
    if not session:
        await ws.send_json({"type": "error", "message": "Session not found"})
        await ws.close()
        return

    # Register WebSocket
    if session_id not in active_websockets:
        active_websockets[session_id] = []
    active_websockets[session_id].append(ws)

    # Send current state
    await ws.send_json({
        "type": "session_state",
        "session": _session_info_dict(session),
        "history": session.history,
    })

    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")

            if msg_type == "prompt":
                prompt = data.get("prompt", "")
                allowed_tools = data.get("allowed_tools", CLAUDE_ALLOWED_TOOLS)
                if not prompt:
                    await ws.send_json({"type": "error", "message": "Empty prompt"})
                    continue

                # Record user message
                user_msg = {
                    "role": "user",
                    "content": prompt,
                    "timestamp": datetime.utcnow().isoformat(),
                }
                session.history.append(user_msg)
                await _broadcast(session_id, {"type": "user_message", "message": user_msg})

                # Run Claude Code CLI
                asyncio.create_task(
                    _run_claude(session, prompt, allowed_tools, session_id)
                )

            elif msg_type == "stop":
                await _kill_process(session)
                await _broadcast(session_id, {"type": "stopped"})

            elif msg_type == "ping":
                await ws.send_json({"type": "pong"})

    except WebSocketDisconnect:
        active_websockets.get(session_id, []).remove(ws) if ws in active_websockets.get(session_id, []) else None


# ---------------------------------------------------------------------------
# Claude Code CLI runner
# ---------------------------------------------------------------------------


async def _run_claude(session: Session, prompt: str, allowed_tools: str, session_id: str):
    session.status = SessionStatus.RUNNING
    await _broadcast(session_id, {"type": "status", "status": "running"})

    cmd = ["claude", "-p", prompt, "--output-format", "stream-json"]

    if allowed_tools:
        cmd.extend(["--allowedTools", allowed_tools])

    if CLAUDE_MODEL:
        cmd.extend(["--model", CLAUDE_MODEL])

    # Resume existing Claude session if we have one
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

        assistant_content = []
        current_text = ""

        # Read stdout line by line (stream-json outputs newline-delimited JSON)
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
                # Not JSON, forward as raw text
                await _broadcast(session_id, {"type": "raw", "text": line_str})
                continue

            event_type = event.get("type", "")

            # Extract Claude session ID from the first system message
            if event_type == "system" and event.get("session_id"):
                session.claude_session_id = event["session_id"]
                await _broadcast(session_id, {
                    "type": "session_info",
                    "claude_session_id": event["session_id"],
                })

            # Stream assistant text
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
                        await _broadcast(session_id, tool_event)

                        # Track file changes
                        if tool_name in ("Write", "Edit", "MultiEdit"):
                            file_path = tool_input.get("file_path", tool_input.get("path", "unknown"))
                            change = {
                                "tool": tool_name,
                                "file": file_path,
                                "timestamp": datetime.utcnow().isoformat(),
                            }
                            session.file_changes.append(change)
                            await _broadcast(session_id, {"type": "file_change", "change": change})

                if current_text:
                    await _broadcast(session_id, {
                        "type": "assistant_text",
                        "text": current_text,
                        "timestamp": datetime.utcnow().isoformat(),
                    })

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
                await _broadcast(session_id, result_event)

                session.history.append({
                    "role": "assistant",
                    "content": result_text,
                    "cost": cost_info,
                    "duration_ms": duration,
                    "timestamp": datetime.utcnow().isoformat(),
                })

            else:
                # Forward any other event types
                await _broadcast(session_id, {"type": "event", "event": event})

        # Read stderr
        stderr = await process.stderr.read()
        if stderr:
            stderr_text = stderr.decode("utf-8").strip()
            if stderr_text:
                await _broadcast(session_id, {"type": "stderr", "text": stderr_text})

        await process.wait()

    except Exception as e:
        session.status = SessionStatus.ERROR
        await _broadcast(session_id, {"type": "error", "message": str(e)})

    finally:
        session.status = SessionStatus.IDLE
        session.process = None
        await _broadcast(session_id, {"type": "status", "status": "idle"})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _broadcast(session_id: str, message: dict):
    """Send message to all connected WebSockets for a session."""
    ws_list = active_websockets.get(session_id, [])
    dead = []
    for ws in ws_list:
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        ws_list.remove(ws)


async def _kill_process(session: Session):
    if session.process and session.process.returncode is None:
        try:
            session.process.terminate()
            await asyncio.wait_for(session.process.wait(), timeout=5)
        except asyncio.TimeoutError:
            session.process.kill()
        except Exception:
            pass
    session.process = None
    session.status = SessionStatus.IDLE


def _session_info(session: Session) -> SessionInfo:
    return SessionInfo(
        id=session.id,
        claude_session_id=session.claude_session_id,
        work_dir=session.work_dir,
        status=session.status.value,
        created_at=session.created_at,
        message_count=len(session.history),
        file_changes_count=len(session.file_changes),
    )


def _session_info_dict(session: Session) -> dict:
    return _session_info(session).model_dump()
