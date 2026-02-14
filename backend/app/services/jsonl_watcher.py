"""JSONL Watcher - import된 로컬 세션의 JSONL 파일을 실시간 감시.

JSONL 파일을 1초 간격 폴링으로 감시하여 새 이벤트를
파싱 -> DB 저장 -> WebSocket 브로드캐스트합니다.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from app.models.session import SessionStatus
from app.services.session_manager import SessionManager
from app.services.websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)

# 폴링 간격 (초)
POLL_INTERVAL = 1.0
# idle 타임아웃 (초) - 새 데이터 없으면 감시 종료
IDLE_TIMEOUT = 120.0
# JSONL 활성 판단 기준 (초) - 파일 수정 시간이 이 시간 이내면 활성
ACTIVE_THRESHOLD = 300.0  # 5분


class JsonlWatcher:
    """JSONL 파일 실시간 감시 서비스.

    import된 로컬 세션의 JSONL 파일을 폴링하여 새 이벤트를
    파싱하고 WebSocket으로 브로드캐스트합니다.
    """

    def __init__(
        self,
        session_manager: SessionManager,
        ws_manager: WebSocketManager,
    ):
        self._session_manager = session_manager
        self._ws_manager = ws_manager
        # 활성 감시 태스크: {session_id: asyncio.Task}
        self._watch_tasks: dict[str, asyncio.Task] = {}

    def is_watching(self, session_id: str) -> bool:
        """세션이 현재 감시 중인지 확인."""
        task = self._watch_tasks.get(session_id)
        return task is not None and not task.done()

    async def start_watching(self, session_id: str, jsonl_path: str) -> bool:
        """JSONL 파일 감시 시작.

        Returns:
            True이면 감시 시작됨, False이면 이미 감시 중이거나 파일 없음.
        """
        if self.is_watching(session_id):
            return False

        path = Path(jsonl_path)
        if not path.exists():
            logger.warning("JSONL 파일 없음, 감시 시작 불가: %s", jsonl_path)
            return False

        task = asyncio.create_task(
            self._watch_loop(session_id, path),
            name=f"jsonl-watch-{session_id[:8]}",
        )
        task.add_done_callback(lambda t: self._on_watch_done(t, session_id))
        self._watch_tasks[session_id] = task
        logger.info("JSONL 감시 시작: session=%s, path=%s", session_id[:8], jsonl_path)
        return True

    def stop_watching(self, session_id: str) -> None:
        """JSONL 파일 감시 중단."""
        task = self._watch_tasks.pop(session_id, None)
        if task and not task.done():
            task.cancel()
            logger.info("JSONL 감시 중단: session=%s", session_id[:8])

    def stop_all(self) -> None:
        """모든 감시 중단 (앱 종료 시)."""
        for sid in list(self._watch_tasks):
            self.stop_watching(sid)

    async def try_auto_start(self, session_id: str) -> bool:
        """세션의 JSONL 파일이 활성 상태이면 자동으로 감시 시작.

        WebSocket 연결 시 호출됩니다.
        """
        if self.is_watching(session_id):
            return True

        session = await self._session_manager.get(session_id)
        if not session:
            return False

        jsonl_path = session.get("jsonl_path")
        if not jsonl_path:
            return False

        path = Path(jsonl_path)
        if not path.exists():
            return False

        # 최근 ACTIVE_THRESHOLD 이내 수정된 파일만 감시
        mtime = path.stat().st_mtime
        now = datetime.now(timezone.utc).timestamp()
        if now - mtime > ACTIVE_THRESHOLD:
            return False

        return await self.start_watching(session_id, jsonl_path)

    def _on_watch_done(self, task: asyncio.Task, session_id: str) -> None:
        """감시 태스크 완료 콜백."""
        self._watch_tasks.pop(session_id, None)
        if task.cancelled():
            return
        exc = task.exception()
        if exc:
            logger.error(
                "JSONL 감시 비정상 종료 (session=%s): %s",
                session_id[:8],
                exc,
            )

    async def _watch_loop(self, session_id: str, path: Path) -> None:
        """JSONL 파일 폴링 루프.

        파일 크기 변화를 감지하여 새 줄을 읽고 이벤트를 처리합니다.
        IDLE_TIMEOUT 동안 새 데이터가 없으면 종료합니다.
        """
        # 현재 파일 끝에서 시작 (기존 내용은 이미 import됨)
        file_size = path.stat().st_size
        last_activity = asyncio.get_event_loop().time()
        turn_state: dict = {"text": "", "model": None, "work_dir": ""}

        # work_dir 초기화
        session = await self._session_manager.get(session_id)
        if session:
            turn_state["work_dir"] = session.get("work_dir", "")

        # 세션이 IDLE인 경우에만 RUNNING으로 전환 (ERROR 상태 덮어쓰기 방지)
        if session and session.get("status") == SessionStatus.IDLE:
            await self._session_manager.update_status(session_id, SessionStatus.RUNNING)
            await self._ws_manager.broadcast_event(
                session_id, {"type": "status", "status": SessionStatus.RUNNING}
            )

        try:
            while True:
                await asyncio.sleep(POLL_INTERVAL)

                if not path.exists():
                    logger.info("JSONL 파일 삭제됨, 감시 종료: %s", path)
                    break

                try:
                    current_size = path.stat().st_size
                except FileNotFoundError:
                    logger.info("JSONL 파일 삭제됨 (stat 실패), 감시 종료: %s", path)
                    break
                if current_size > file_size:
                    # 새 데이터 있음
                    new_lines = await asyncio.to_thread(
                        self._read_new_lines, path, file_size
                    )
                    file_size = current_size
                    last_activity = asyncio.get_event_loop().time()

                    for line in new_lines:
                        await self._process_line(line, session_id, turn_state)
                elif current_size < file_size:
                    # 파일이 줄어듦 (truncate 또는 재생성) → 처음부터 다시 읽기
                    file_size = 0
                    last_activity = asyncio.get_event_loop().time()

                # idle 타임아웃 체크
                elapsed = asyncio.get_event_loop().time() - last_activity
                if elapsed >= IDLE_TIMEOUT:
                    logger.info(
                        "JSONL idle 타임아웃 (%ds), 감시 종료: session=%s",
                        int(elapsed),
                        session_id[:8],
                    )
                    break
        finally:
            # RUNNING 상태인 경우에만 IDLE로 전환 (ERROR 상태 보존)
            current = await self._session_manager.get(session_id)
            if current and current.get("status") == SessionStatus.RUNNING:
                await self._session_manager.update_status(
                    session_id, SessionStatus.IDLE
                )
                await self._ws_manager.broadcast_event(
                    session_id, {"type": "status", "status": SessionStatus.IDLE}
                )

    @staticmethod
    def _read_new_lines(path: Path, offset: int) -> list[str]:
        """파일의 offset 이후 새 줄을 읽어 반환."""
        lines: list[str] = []
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            f.seek(offset)
            for line in f:
                stripped = line.strip()
                if stripped:
                    lines.append(stripped)
        return lines

    async def _process_line(
        self,
        line: str,
        session_id: str,
        turn_state: dict,
    ) -> None:
        """JSONL 한 줄을 파싱하고 이벤트 타입에 따라 처리."""
        try:
            event = json.loads(line)
        except json.JSONDecodeError as e:
            logger.warning("JSONL 파싱 실패 (session=%s): %s", session_id[:8], e)
            return

        event_type = event.get("type", "")

        if event_type == "system":
            await self._handle_system_event(event, session_id)
        elif event_type == "assistant":
            await self._handle_assistant_event(event, session_id, turn_state)
        elif event_type == "user":
            await self._handle_user_event(event, session_id)
        elif event_type == "result":
            await self._handle_result_event(event, session_id, turn_state)
        else:
            # 알 수 없는 이벤트는 원본 그대로 전달
            await self._ws_manager.broadcast_event(
                session_id, {"type": "event", "event": event}
            )

    async def _handle_system_event(self, event: dict, session_id: str) -> None:
        """system 이벤트 처리."""
        if event.get("session_id"):
            await self._session_manager.update_claude_session_id(
                session_id, event["session_id"]
            )
            await self._ws_manager.broadcast_event(
                session_id,
                {"type": "session_info", "claude_session_id": event["session_id"]},
            )
        else:
            await self._ws_manager.broadcast_event(
                session_id, {"type": "event", "event": event}
            )

    async def _handle_assistant_event(
        self, event: dict, session_id: str, turn_state: dict
    ) -> None:
        """assistant 이벤트 처리 (text, thinking, tool_use, file_change)."""
        msg = event.get("message", {})
        content_blocks = msg.get("content", [])

        model = msg.get("model")
        if model:
            turn_state["model"] = model

        has_new_text = False
        for block in content_blocks:
            block_type = block.get("type", "")

            if block_type == "thinking":
                thinking_text = block.get("thinking", "")
                if thinking_text:
                    await self._ws_manager.broadcast_event(
                        session_id,
                        {
                            "type": "thinking",
                            "text": thinking_text,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        },
                    )

            elif block_type == "text":
                turn_state["text"] = block.get("text", "")
                has_new_text = True

            elif block_type == "tool_use":
                tool_name = block.get("name", "unknown")
                tool_input = block.get("input", {})
                tool_use_id = block.get("id", "")

                # AskUserQuestion 감지: 인터랙티브 질문 이벤트로 변환
                if tool_name == "AskUserQuestion":
                    await self._ws_manager.broadcast_event(
                        session_id,
                        {
                            "type": "ask_user_question",
                            "questions": tool_input.get("questions", []),
                            "tool_use_id": tool_use_id,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        },
                    )
                    continue

                await self._ws_manager.broadcast_event(
                    session_id,
                    {
                        "type": "tool_use",
                        "tool": tool_name,
                        "input": tool_input,
                        "tool_use_id": tool_use_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )

                # 파일 변경 추적
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
                    await self._session_manager.add_file_change(
                        session_id, tool_name, file_path, ts
                    )
                    await self._ws_manager.broadcast_event(
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

        if has_new_text and turn_state["text"]:
            await self._ws_manager.broadcast_event(
                session_id,
                {
                    "type": "assistant_text",
                    "text": turn_state["text"],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )

    async def _handle_user_event(self, event: dict, session_id: str) -> None:
        """user 이벤트 (tool_result) 처리."""
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
                await self._ws_manager.broadcast_event(
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
        self, event: dict, session_id: str, turn_state: dict
    ) -> None:
        """result 이벤트 처리 (최종 응답)."""
        result_text = event.get("result") or ""
        if not result_text and turn_state.get("text"):
            result_text = turn_state["text"]
        is_error = event.get("is_error", False)
        cost_info = event.get("cost_usd", event.get("cost", None))
        duration = event.get("duration_ms", None)
        session_id_from_result = event.get("session_id", None)

        usage = event.get("usage", {})
        input_tokens = usage.get("input_tokens")
        output_tokens = usage.get("output_tokens")
        cache_creation_tokens = usage.get("cache_creation_input_tokens")
        cache_read_tokens = usage.get("cache_read_input_tokens")
        model = turn_state.get("model")

        # 세션의 현재 mode 조회 (ClaudeRunner와 동일하게 포함)
        mode = "normal"
        session = await self._session_manager.get(session_id)
        if session:
            mode = session.get("mode", "normal")

        if session_id_from_result:
            await self._session_manager.update_claude_session_id(
                session_id, session_id_from_result
            )

        result_event = {
            "type": "result",
            "text": result_text,
            "is_error": is_error,
            "cost": cost_info,
            "duration_ms": duration,
            "session_id": session_id_from_result,
            "mode": mode,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cache_creation_tokens": cache_creation_tokens,
            "cache_read_tokens": cache_read_tokens,
            "model": model,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await self._ws_manager.broadcast_event(session_id, result_event)

        if is_error:
            await self._session_manager.update_status(session_id, SessionStatus.ERROR)

        await self._session_manager.add_message(
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

        # turn_state 리셋 (다음 턴 준비)
        turn_state["text"] = ""
        turn_state["model"] = None

    @staticmethod
    def _normalize_file_path(file_path: str, work_dir: str) -> str:
        """파일 경로를 work_dir 기준 상대 경로로 정규화."""
        p = Path(file_path)
        if p.is_absolute():
            try:
                return str(p.resolve().relative_to(Path(work_dir).resolve()))
            except ValueError:
                return file_path
        return file_path
