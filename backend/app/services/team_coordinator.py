"""팀 태스크 위임 및 실시간 이벤트 조정 서비스."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from fastapi import WebSocket
from starlette.websockets import WebSocketState

from app.core.database import Database
from app.models.event_types import WsEventType
from app.repositories.team_repo import TeamMemberRepository, TeamRepository
from app.repositories.team_task_repo import TeamTaskRepository

# 리드 세션 응답에서 @delegate 패턴 감지
DELEGATE_PATTERN = re.compile(
    r"@delegate\(([^)]+)\):\s*(.+?)(?=@delegate|\Z)", re.DOTALL
)

if TYPE_CHECKING:
    from app.services.claude_runner import ClaudeRunner
    from app.services.session_manager import SessionManager
    from app.services.websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)


class TeamCoordinator:
    """팀 태스크 위임, 세션 완료 콜백, 팀 이벤트 브로드캐스트 조정."""

    def __init__(
        self,
        db: Database,
        session_manager: SessionManager,
        ws_manager: WebSocketManager,
        claude_runner: ClaudeRunner,
    ) -> None:
        self._db = db
        self._session_manager = session_manager
        self._ws_manager = ws_manager
        self._claude_runner = claude_runner
        # 팀 대시보드 WS 연결 관리
        self._team_connections: dict[str, list[WebSocket]] = {}

    # ── 팀 대시보드 WebSocket 관리 ──

    def register_team_ws(self, team_id: str, ws: WebSocket) -> None:
        self._team_connections.setdefault(team_id, []).append(ws)

    def unregister_team_ws(self, team_id: str, ws: WebSocket) -> None:
        conns = self._team_connections.get(team_id)
        if conns:
            try:
                conns.remove(ws)
            except ValueError:
                pass
            if not conns:
                del self._team_connections[team_id]

    # ── 팀 이벤트 브로드캐스트 ──

    async def broadcast_team_event(self, team_id: str, event: dict) -> None:
        """팀 대시보드 WS + 팀 멤버 세션 WS에 이벤트 전파."""
        event["team_id"] = team_id
        event["timestamp"] = datetime.now(timezone.utc).isoformat()
        payload = json.dumps(event)

        # 1. 팀 대시보드 WS 연결에 직접 전송
        conns = self._team_connections.get(team_id, [])
        closed = []
        for ws in conns:
            try:
                if ws.client_state == WebSocketState.CONNECTED:
                    await ws.send_text(payload)
                else:
                    closed.append(ws)
            except Exception:
                closed.append(ws)
        for ws in closed:
            self.unregister_team_ws(team_id, ws)

        # 2. 팀 멤버들의 세션 WS에도 전파
        async with self._db.session() as session:
            member_repo = TeamMemberRepository(session)
            members = await member_repo.get_members(team_id)
        for member in members:
            await self._ws_manager.broadcast_event(member.session_id, event)

    # ── 태스크 위임 ──

    async def delegate_task(
        self,
        team_id: str,
        task_id: int,
        target_session_id: str,
        prompt: str | None = None,
    ) -> dict:
        """태스크를 특정 세션에 위임 (태스크 선점 + 프롬프트 전송 + 실행)."""
        from app.services.team_task_service import TeamTaskService

        task_service = TeamTaskService(self._db)

        # 1. 태스크 선점
        task_info = await task_service.claim_task(task_id, target_session_id)
        if not task_info:
            raise ValueError("태스크를 선점할 수 없습니다 (이미 진행 중이거나 존재하지 않음)")

        # 2. 대상 세션 상태 확인
        target_session = await self._session_manager.get(target_session_id)
        if not target_session:
            raise ValueError(f"세션 {target_session_id}을(를) 찾을 수 없습니다")

        existing_task = self._session_manager.get_runner_task(target_session_id)
        if existing_task:
            raise ValueError(f"세션 {target_session_id}이(가) 이미 실행 중입니다")

        # 3. 프롬프트 구성
        delegate_prompt = prompt or task_info.description or task_info.title

        # 4. 위임 이벤트 브로드캐스트
        await self.broadcast_team_event(
            team_id,
            {
                "type": WsEventType.TEAM_TASK_DELEGATED,
                "task_id": task_id,
                "task_title": task_info.title,
                "target_session_id": target_session_id,
            },
        )

        # 5. 세션에 프롬프트 전송 (Claude 실행)
        from app.api.dependencies import get_mcp_service, get_settings_service

        settings_service = get_settings_service()
        global_settings = await settings_service.get()

        allowed_tools = (
            target_session.get("allowed_tools")
            or global_settings.get("allowed_tools")
            or ""
        )
        mode = target_session.get("mode") or global_settings.get("mode") or "normal"

        # 메시지 저장
        ts = datetime.now(timezone.utc).isoformat()
        await self._session_manager.add_message(
            session_id=target_session_id,
            role="user",
            content=delegate_prompt,
            timestamp=ts,
        )
        await self._ws_manager.broadcast_event(
            target_session_id,
            {
                "type": WsEventType.USER_MESSAGE,
                "message": {
                    "role": "user",
                    "content": delegate_prompt,
                    "timestamp": ts,
                },
            },
        )

        # 글로벌 설정 병합
        merged_session = dict(target_session)
        for key in [
            "system_prompt",
            "timeout_seconds",
            "permission_mode",
            "permission_required_tools",
            "model",
            "max_turns",
            "max_budget_usd",
            "system_prompt_mode",
            "disallowed_tools",
            "mcp_server_ids",
        ]:
            if not merged_session.get(key) and global_settings.get(key):
                merged_session[key] = global_settings[key]

        mcp_service = get_mcp_service()

        runner_task = asyncio.create_task(
            self._claude_runner.run(
                merged_session,
                delegate_prompt,
                allowed_tools,
                target_session_id,
                self._ws_manager,
                self._session_manager,
                mode=mode,
                mcp_service=mcp_service,
            )
        )

        def _on_done(t, sid=target_session_id):
            self._session_manager.clear_runner_task(sid)

        runner_task.add_done_callback(_on_done)
        self._session_manager.set_runner_task(target_session_id, runner_task)

        return {
            "task_id": task_id,
            "target_session_id": target_session_id,
            "status": "delegated",
        }

    # ── 세션 완료 콜백 ──

    async def on_session_completed(
        self, session_id: str, last_text: str | None = None
    ) -> None:
        """세션 runner 완료 시 호출. 팀 소속이면 태스크 상태 업데이트."""
        async with self._db.session() as db_session:
            # 이 세션이 팀에 속하는지 확인
            member_repo = TeamMemberRepository(db_session)
            teams = await member_repo.get_teams_by_session(session_id)

            if not teams:
                return

            # 이 세션에 할당된 진행 중 태스크 확인
            task_repo = TeamTaskRepository(db_session)
            for team_info in teams:
                tid = team_info["team_id"]
                tasks = await task_repo.list_by_team(tid, status="in_progress")
                for task in tasks:
                    if task.assigned_session_id == session_id:
                        # 결과 요약 추출 (마지막 텍스트에서 앞 200자)
                        result_summary = None
                        if last_text:
                            result_summary = last_text[:200]
                            if len(last_text) > 200:
                                result_summary += "…"

                        # 태스크 완료 처리
                        task = await task_repo.complete_task(
                            task.id, result_summary
                        )
                        await db_session.commit()

                        logger.info(
                            "팀 %s 태스크 %d 자동 완료 (세션 %s)",
                            tid,
                            task.id,
                            session_id,
                        )

                        # 팀 이벤트 브로드캐스트
                        await self.broadcast_team_event(
                            tid,
                            {
                                "type": WsEventType.TEAM_TASK_COMPLETED,
                                "task_id": task.id,
                                "task_title": task.title,
                                "session_id": session_id,
                                "result_summary": result_summary,
                            },
                        )

    # ── 리드 세션 시스템 프롬프트 주입 ──

    async def inject_team_context(self, session_id: str) -> str | None:
        """리드 세션의 시스템 프롬프트에 추가할 팀 컨텍스트 텍스트 반환."""
        async with self._db.session() as db_session:
            member_repo = TeamMemberRepository(db_session)
            teams = await member_repo.get_teams_by_session(session_id)
            if not teams:
                return None

            # 이 세션이 리드인 팀 찾기
            team_repo = TeamRepository(db_session)
            for team_info in teams:
                tid = team_info["team_id"]
                team = await team_repo.get_by_id(tid)
                if not team or team.lead_session_id != session_id:
                    continue

                # 리드 세션임 → 팀 컨텍스트 구성
                members = await member_repo.get_members(tid)
                task_repo = TeamTaskRepository(db_session)
                all_tasks = await task_repo.list_by_team(tid)

                # 멤버 정보
                member_lines = []
                for m in members:
                    s = await self._session_manager.get(m.session_id)
                    status = s.get("status", "unknown") if s else "unknown"
                    name = m.nickname or m.session_id[:8]
                    role_tag = " (리드)" if m.role == "lead" else ""
                    member_lines.append(
                        f"- {name} (세션: {m.session_id[:8]}, 상태: {status}){role_tag}"
                    )

                # 태스크 정보
                task_lines = []
                nickname_map = {m.session_id: (m.nickname or m.session_id[:8]) for m in members}
                for t in all_tasks:
                    status_icon = {"pending": "대기", "in_progress": "진행중", "completed": "완료", "failed": "실패"}.get(t.status, t.status)
                    assignee = ""
                    if t.assigned_session_id:
                        assignee = f" ({nickname_map.get(t.assigned_session_id, t.assigned_session_id[:8])})"
                    task_lines.append(f"- [{status_icon}] {t.title}{assignee}")

                context = f"""당신은 팀의 리드 에이전트입니다.

## 팀원
{chr(10).join(member_lines)}

## 현재 태스크
{chr(10).join(task_lines) if task_lines else "- (태스크 없음)"}

## 위임 규약
팀원에게 작업을 위임하려면 다음 형식을 사용하세요:
@delegate(닉네임): 작업 설명"""

                return context

        return None

    # ── 자동 위임 ──

    async def auto_delegate(
        self, team_id: str, nickname: str, description: str
    ) -> None:
        """@delegate 패턴 감지 시 태스크 생성 + 위임."""
        from app.services.team_task_service import TeamTaskService

        async with self._db.session() as db_session:
            member_repo = TeamMemberRepository(db_session)
            members = await member_repo.get_members(team_id)

        # 닉네임으로 세션 찾기
        target = None
        for m in members:
            if m.nickname == nickname or m.session_id.startswith(nickname):
                target = m
                break

        if not target:
            logger.warning(
                "팀 %s: @delegate 대상 '%s'을(를) 찾을 수 없습니다",
                team_id,
                nickname,
            )
            return

        # 태스크 생성
        task_service = TeamTaskService(self._db)
        task_info = await task_service.create_task(
            team_id=team_id,
            title=description[:100],
            description=description,
            priority="medium",
            assigned_session_id=None,
        )

        # 위임 실행
        try:
            await self.delegate_task(
                team_id=team_id,
                task_id=task_info.id,
                target_session_id=target.session_id,
                prompt=description,
            )
            logger.info(
                "팀 %s: 태스크 '%s' → %s 자동 위임",
                team_id,
                description[:50],
                nickname,
            )
        except ValueError as e:
            logger.warning(
                "팀 %s: 자동 위임 실패 (%s → %s): %s",
                team_id,
                description[:50],
                nickname,
                e,
            )

    def parse_delegate_commands(self, text: str) -> list[tuple[str, str]]:
        """텍스트에서 @delegate(nickname): description 패턴을 추출."""
        return [
            (nickname.strip(), desc.strip())
            for nickname, desc in DELEGATE_PATTERN.findall(text)
        ]
