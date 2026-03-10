"""WebSocket 엔드포인트 - 실시간 스트리밍."""

import asyncio
from collections import OrderedDict
from uuid import uuid4

import structlog
from structlog.contextvars import bind_contextvars, clear_contextvars

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.api.dependencies import (
    get_claude_memory_service,
    get_claude_runner,
    get_insight_service,
    get_jsonl_watcher,
    get_mcp_service,
    get_session_manager,
    get_settings,
    get_settings_service,
    get_workflow_service,
    get_ws_manager,
)
from app.core.utils import utc_now
from app.services.pending_questions import (
    clear_pending_question,
    get_pending_question,
)
from app.api.v1.endpoints.permissions import get_pending, respond_permission
from app.models.event_types import WsEventType
from app.services.claude_runner import ClaudeRunner
from app.services.session_manager import SessionManager
from app.services.websocket_manager import WebSocketManager

logger = structlog.get_logger(__name__)

router = APIRouter()

# 세션별 프롬프트 Lock (LRU 200: 메모리 누수 방지)
_PROMPT_LOCKS_MAX = 200


class _LRULocks(OrderedDict):
    """LRU 제한이 있는 asyncio.Lock 딕셔너리."""

    def get_or_create(self, key: str) -> asyncio.Lock:
        if key in self:
            self.move_to_end(key)
            return self[key]
        lock = asyncio.Lock()
        self[key] = lock
        while len(self) > _PROMPT_LOCKS_MAX:
            self.popitem(last=False)
        return lock


_prompt_locks = _LRULocks()


def _on_runner_task_done(
    task: asyncio.Task, session_id: str, manager: SessionManager
) -> None:
    """runner task 완료 시 예외 로깅 + runner_task 참조 정리 콜백."""
    manager.clear_runner_task_if_match(session_id, task)
    if task.cancelled():
        return
    exc = task.exception()
    if exc:
        logger.error("Runner task 비정상 종료 (세션 %s): %s", session_id, exc)


async def _handle_prompt(
    data: dict,
    session_id: str,
    manager: SessionManager,
    ws_manager: WebSocketManager,
    ws: WebSocket,
    settings,
    runner: ClaudeRunner,
) -> None:
    """prompt 메시지 처리: 유효성 검사, 메시지 저장, runner task 생성."""
    prompt = data.get("prompt", "")
    if not prompt:
        await ws.send_json(
            {"type": WsEventType.ERROR, "message": "프롬프트가 비어있습니다"}
        )
        return

    # 세션별 Lock으로 TOCTOU 방지 (runner_task 체크 → 설정 사이의 경합 차단)
    lock = _prompt_locks.get_or_create(session_id)
    async with lock:
        # 이미 실행 중인 runner가 있으면 거부
        existing_task = manager.get_runner_task(session_id)
        if existing_task:
            await ws.send_json(
                {
                    "type": WsEventType.ERROR,
                    "message": "이미 실행 중인 요청이 있습니다.",
                }
            )
            return

        # ---- 턴 ID 생성 + 컨텍스트 바인딩 ----
        turn_id = uuid4().hex[:12]
        bind_contextvars(turn_id=turn_id)
        logger.info(
            "프롬프트 수신",
            component="ws",
            operation="message_receive",
            prompt_length=len(prompt),
        )

        # 세션 정보 로드
        current_session = await manager.get(session_id)
        if current_session and current_session.get("workspace_id"):
            bind_contextvars(workspace_id=current_session["workspace_id"])

        # 글로벌 기본 설정 로드
        settings_service = get_settings_service()
        global_settings = await settings_service.get()

        # allowed_tools: 요청 > 세션 > 글로벌 > env
        allowed_tools = (
            data.get("allowed_tools")
            or (current_session.get("allowed_tools") if current_session else None)
            or global_settings.get("allowed_tools")
            or settings.claude_allowed_tools
        )

        # 이미지 경로 목록 (업로드 API로 먼저 업로드한 파일 경로)
        images = data.get("images", [])

        # 세션에 이름이 없으면 첫 프롬프트로 자동 이름 설정
        if current_session and not current_session.get("name"):
            auto_name = prompt[:40].strip()
            if len(prompt) > 40:
                auto_name += "…"
            await manager.update_settings(session_id, name=auto_name)

        # 메시지 DB 저장 + USER_MESSAGE 즉시 브로드캐스트 (워크플로우 처리 전)
        ts_dt = utc_now()
        await manager.add_message(
            session_id=session_id,
            role="user",
            content=prompt,
            timestamp=ts_dt,
        )
        user_msg = {
            "role": "user",
            "content": prompt,
            "timestamp": ts_dt.isoformat(),
        }
        await ws_manager.broadcast_event(
            session_id, {"type": WsEventType.USER_MESSAGE, "message": user_msg}
        )

        # 대기 중인 AskUserQuestion 클리어 (사용자가 답변 또는 새 프롬프트 전송)
        await clear_pending_question(session_id)

        # 워크플로우 처리
        workflow_phase = None
        workflow_service = None
        workflow_step_config = None
        claude_prompt = prompt

        # 워크플로우 활성 상태면 준비 중 상태 알림
        has_workflow = current_session and (
            current_session.get("workflow_phase")
            or (
                current_session.get("workflow_phase_status")
                and current_session.get("workflow_phase_status") != "completed"
            )
        )
        if has_workflow:
            await ws_manager.broadcast_event(
                session_id, {"type": WsEventType.STATUS, "status": "preparing"}
            )

        if current_session:
            wf_phase = current_session.get("workflow_phase")
            wf_status = current_session.get("workflow_phase_status")

            # 워크플로우 활성화 상태인 경우에만 게이트 로직 실행
            if wf_phase or (wf_status and wf_status != "completed"):
                workflow_service = get_workflow_service()
                workflow_phase, workflow_step_config, gate_error = (
                    await workflow_service.resolve_workflow_state(
                        session_id, current_session, manager, ws_manager,
                    )
                )
                # 세션 정보 재로드 (resolve_workflow_state가 업데이트할 수 있음)
                if workflow_phase:
                    current_session = await manager.get(session_id)

                if gate_error:
                    await ws.send_json(
                        {"type": WsEventType.ERROR, "message": gate_error}
                    )
                    return

                # 워크플로우 최초 프롬프트 저장 (phase 컨텍스트 빌드에 사용)
                if workflow_phase and not current_session.get("workflow_original_prompt"):
                    await manager.update_settings(
                        session_id, workflow_original_prompt=prompt
                    )

                # Phase별 컨텍스트 프롬프트 구성
                if workflow_phase and workflow_service:
                    # claude_session_id가 있으면 경량 컨텍스트 (continuation turn)
                    has_session = bool(current_session.get("claude_session_id"))
                    phase_context = await workflow_service.build_phase_context(
                        session_id,
                        workflow_phase,
                        prompt,
                        session_manager=manager,
                        is_continuation=has_session,
                    )
                    if phase_context:
                        claude_prompt = phase_context

        # 글로벌 기본값으로 세션 설정 병합
        merged_session = settings_service.merge_session_with_globals(
            current_session, global_settings
        )

        # Knowledge Base 컨텍스트 자동 주입
        try:
            work_dir = current_session.get("work_dir")
            if work_dir:
                memory_svc = get_claude_memory_service()
                memory_ctx = await memory_svc.build_memory_context(work_dir)
                if memory_ctx.context_text:
                    existing = merged_session.get("system_prompt") or ""
                    kb_block = (
                        "\n\n<knowledge_base>\n"
                        + memory_ctx.context_text
                        + "\n</knowledge_base>"
                    )
                    merged_session["system_prompt"] = (
                        existing + kb_block if existing else kb_block
                    )
                    logger.info(
                        "KB 컨텍스트 주입 성공",
                        component="context",
                        operation="kb_inject",
                        context_length=len(memory_ctx.context_text),
                    )
        except Exception:
            logger.warning(
                "KB 컨텍스트 주입 실패",
                component="context",
                operation="kb_inject",
                is_error=True,
                exc_info=True,
            )

        # Workspace Insights 컨텍스트 자동 주입
        try:
            ws_id = (
                current_session.get("workspace_id") if current_session else None
            )
            if ws_id:
                insight_svc = get_insight_service()
                insight_ctx = await insight_svc.build_insight_context(ws_id)
                if insight_ctx:
                    existing = merged_session.get("system_prompt") or ""
                    insights_block = (
                        "\n\n<workspace_insights>\n"
                        + insight_ctx
                        + "\n</workspace_insights>"
                    )
                    merged_session["system_prompt"] = (
                        existing + insights_block
                        if existing
                        else insights_block
                    )
                    logger.info(
                        "인사이트 컨텍스트 주입 성공",
                        component="context",
                        operation="insights_inject",
                        context_length=len(insight_ctx),
                    )
        except Exception:
            logger.warning(
                "인사이트 컨텍스트 주입 실패",
                component="context",
                operation="insights_inject",
                is_error=True,
                exc_info=True,
            )

        # MCP 서비스 주입
        mcp_service = get_mcp_service()

        # ClaudeRunner에 최신 세션 정보 전달
        task = asyncio.create_task(
            runner.run(
                merged_session,
                claude_prompt if workflow_phase else prompt,
                allowed_tools,
                session_id,
                ws_manager,
                manager,
                images=images,
                mcp_service=mcp_service,
                workflow_phase=workflow_phase,
                workflow_service=workflow_service,
                original_prompt=prompt,
                workflow_step_config=workflow_step_config,
            )
        )
        task.add_done_callback(lambda t: _on_runner_task_done(t, session_id, manager))
        manager.set_runner_task(session_id, task)
        logger.info(
            "러너 턴 시작",
            component="runner",
            operation="turn_start",
            workflow_phase=workflow_phase,
            has_images=bool(images),
        )
        if workflow_phase:
            bind_contextvars(workflow_phase=workflow_phase)


async def _handle_stop(
    session_id: str,
    manager: SessionManager,
    ws_manager: WebSocketManager,
) -> None:
    """stop 메시지 처리: 프로세스 종료 (kill_process가 runner_task도 취소)."""
    logger.info("러너 중지 요청", component="runner", operation="stop")
    await manager.kill_process(session_id)
    await ws_manager.broadcast_event(session_id, {"type": WsEventType.STOPPED})


async def _handle_clear(
    session_id: str,
    manager: SessionManager,
    ws_manager: WebSocketManager,
) -> None:
    """clear 메시지 처리: 대화 기록 삭제 + claude_session_id 초기화 + 워크플로우 리셋 → 새 대화 시작."""
    # 1. Claude CLI 세션 ID 초기화 (다음 프롬프트에서 --resume 없이 새 대화)
    await manager.update_claude_session_id(session_id, "")
    # 2. DB에서 메시지/파일변경/이벤트 삭제
    await manager.clear_history(session_id)
    # 3. 워크플로우 상태 리셋 (Research 초기 상태 + 아티팩트 삭제)
    current_session = await manager.get(session_id)
    if current_session:
        workflow_service = get_workflow_service()
        await workflow_service.reset_workflow(session_id, manager)
    # 4. 인메모리 이벤트 버퍼 + seq 카운터 초기화
    ws_manager.reset_session(session_id)
    # 5. 클라이언트에 직접 알림 (reset 후이므로 broadcast_event 대신 broadcast 사용)
    await ws_manager.broadcast(
        session_id,
        {
            "type": WsEventType.SYSTEM,
            "message": "대화 컨텍스트가 초기화되었습니다",
        },
    )


async def _handle_permission_respond(data: dict) -> None:
    """permission_respond 메시지 처리."""
    perm_id = data.get("permission_id", "")
    behavior = data.get("behavior", "deny")
    trust_level = data.get("trust_level", "once")
    if perm_id:
        await respond_permission(perm_id, behavior, trust_level)


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(ws: WebSocket, session_id: str):
    await ws.accept()
    clear_contextvars()
    bind_contextvars(session_id=session_id)
    is_reconnect = ws.query_params.get("last_seq") is not None
    logger.info(
        "WebSocket 연결",
        component="ws",
        operation="connect",
        is_reconnect=is_reconnect,
    )

    manager = get_session_manager()
    ws_manager = get_ws_manager()
    settings = get_settings()
    runner = get_claude_runner()
    jsonl_watcher = get_jsonl_watcher()

    session = await manager.get(session_id)
    if not session:
        await ws.send_json(
            {
                "type": WsEventType.ERROR,
                "message": "세션을 찾을 수 없습니다",
                "code": "SESSION_NOT_FOUND",
            }
        )
        await ws.close()
        return

    # last_seq 쿼리 파라미터 파싱 (재연결 시)
    last_seq_param = ws.query_params.get("last_seq")
    last_seq = (
        int(last_seq_param) if last_seq_param and last_seq_param.isdigit() else None
    )

    ws_manager.register(session_id, ws)

    try:
        # is_running 판단을 먼저 수행 (try_auto_start 이전)
        # try_auto_start가 먼저 실행되면 방금 시작한 watcher가
        # is_running=true를 만들어 idle 세션이 running으로 보이는 버그 발생
        session_with_counts = await manager.get_with_counts(session_id) or session
        latest_seq = ws_manager.get_latest_seq(session_id)
        is_running = manager.get_runner_task(
            session_id
        ) is not None or jsonl_watcher.is_watching(session_id)

        # JSONL 감시 자동 시작 (import된 세션 + 활성 JSONL 파일)
        # is_running 판단 이후에 시작하여 향후 이벤트 모니터링 용도로만 사용
        await jsonl_watcher.try_auto_start(session_id)

        if last_seq is not None:
            # 재연결: 세션 상태만 전송 (히스토리 없음) + 놓친 이벤트 전송
            reconnect_msg: dict = {
                "type": WsEventType.SESSION_STATE,
                "session": manager.to_info_dict(session_with_counts),
                "file_changes": await manager.get_file_changes(session_id),
                "latest_seq": latest_seq,
                "is_reconnect": True,
                "is_running": is_running,
            }
            await ws.send_json(reconnect_msg)
            # 놓친 이벤트 조회 및 전송
            missed = await ws_manager.get_buffered_events_after(session_id, last_seq)
            if missed:
                await ws.send_json(
                    {
                        "type": WsEventType.MISSED_EVENTS,
                        "events": missed,
                        "latest_seq": latest_seq,
                    }
                )
        else:
            # 최초 연결: 기존 로직 + latest_seq 필드 추가
            history = await manager.get_history(session_id)
            file_changes = await manager.get_file_changes(session_id)
            session_info = manager.to_info_dict(session_with_counts)
            state_msg: dict = {
                "type": WsEventType.SESSION_STATE,
                "session": session_info,
                "history": history,
                "file_changes": file_changes,
                "latest_seq": latest_seq,
                "is_running": is_running,
            }
            # 현재 턴 이벤트 전송 (running 상태일 때만)
            # idle/error 상태에서는 DB fallback 조회를 스킵하여 연결 시간 단축
            if is_running:
                current_turn = await ws_manager.get_current_turn_events(session_id)
                if current_turn:
                    state_msg["current_turn_events"] = current_turn

            # 대기 중인 인터랙션 (permission 등) 상태 전달
            # 프론트엔드가 네비게이션 후 돌아왔을 때 질문 UI를 복구하는 권위적 소스
            pending_interactions: dict = {}
            for perm_id, entry in get_pending().items():
                if (
                    entry.get("session_id") == session_id
                    and entry.get("response") is None
                ):
                    pending_interactions["permission"] = {
                        "permission_id": perm_id,
                        "tool_name": entry["tool_name"],
                        "tool_input": entry["tool_input"],
                    }
                    break
            # 대기 중인 AskUserQuestion 복원
            pending_q = await get_pending_question(session_id)
            if pending_q:
                pending_interactions["ask_user_question"] = {
                    "questions": pending_q["questions"],
                    "tool_use_id": pending_q["tool_use_id"],
                    "timestamp": pending_q["timestamp"],
                }
            if pending_interactions:
                state_msg["pending_interactions"] = pending_interactions

            await ws.send_json(state_msg)

        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")

            try:
                if msg_type == "prompt":
                    await _handle_prompt(
                        data,
                        session_id,
                        manager,
                        ws_manager,
                        ws,
                        settings,
                        runner,
                    )

                elif msg_type == "stop":
                    await _handle_stop(session_id, manager, ws_manager)

                elif msg_type == "clear":
                    await _handle_clear(session_id, manager, ws_manager)

                elif msg_type == "permission_respond":
                    await _handle_permission_respond(data)

                elif msg_type == "ping":
                    await ws.send_json({"type": WsEventType.PONG})

            except WebSocketDisconnect:
                raise  # 상위 except에서 처리
            except Exception as e:
                logger.error(
                    "메시지 처리 오류 (세션 %s, type=%s): %s",
                    session_id,
                    msg_type,
                    e,
                    exc_info=True,
                )
                try:
                    await ws.send_json(
                        {
                            "type": WsEventType.ERROR,
                            "message": "서버 내부 오류가 발생했습니다",
                        }
                    )
                except Exception:
                    logger.debug(
                        "세션 %s: 에러 메시지 WebSocket 전송 실패 (연결 끊김)",
                        session_id,
                    )

    except WebSocketDisconnect:
        pass
    finally:
        logger.info("WebSocket 연결 종료", component="ws", operation="disconnect")
        clear_contextvars()
        # runner_task는 취소하지 않음 - Claude 프로세스와 함께 살아있어야 함
        ws_manager.unregister(session_id, ws)
        # LRU가 자동으로 크기를 관리하므로 명시적 정리 불필요
