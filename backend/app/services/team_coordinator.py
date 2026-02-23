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
    """팀 태스크 위임, 세션 완료 콜백, 팀 이벤트 브로드캐스트 조정.

    재설계: 멤버는 페르소나(역할 정의), 세션은 태스크 위임 시 동적 생성.
    """

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
        """팀 대시보드 WS에 이벤트 전파."""
        event["team_id"] = team_id
        event["timestamp"] = datetime.now(timezone.utc).isoformat()
        payload = json.dumps(event)

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

    # ── 태스크 위임 (세션 동적 생성) ──

    async def delegate_task(
        self,
        team_id: str,
        task_id: int,
        member_id: int | None = None,
        prompt: str | None = None,
    ) -> dict:
        """태스크를 멤버에게 위임. 멤버 설정 + 태스크 work_dir로 세션을 동적 생성."""
        async with self._db.session() as db_sess:
            task_repo = TeamTaskRepository(db_sess)
            task = await task_repo.get_by_id(task_id)
            if not task:
                raise ValueError("태스크를 찾을 수 없습니다")

            # 대상 멤버 결정
            target_member_id = member_id or task.assigned_member_id
            if not target_member_id:
                raise ValueError("위임 대상 멤버가 지정되지 않았습니다")

            member_repo = TeamMemberRepository(db_sess)
            member = await member_repo.get_member_by_id(target_member_id)
            if not member or member.team_id != team_id:
                raise ValueError("대상 멤버를 찾을 수 없습니다")

            # 태스크 선점
            if task.status == "pending":
                task = await task_repo.claim_task(task_id, target_member_id)
                if not task:
                    raise ValueError("태스크를 선점할 수 없습니다")
                await db_sess.commit()

        # 세션 동적 생성 (멤버 페르소나 설정 + 태스크 work_dir)
        session_data = await self._session_manager.create(
            work_dir=task.work_dir,
            allowed_tools=member.allowed_tools or "",
            system_prompt=member.system_prompt,
            model=member.model,
            max_turns=member.max_turns,
            max_budget_usd=member.max_budget_usd,
            disallowed_tools=member.disallowed_tools,
            mcp_server_ids=member.mcp_server_ids,
            name=f"[Team] {member.nickname} - {task.title[:40]}",
        )
        new_session_id = session_data["id"]

        # 태스크에 세션 ID 기록
        async with self._db.session() as db_sess:
            task_repo = TeamTaskRepository(db_sess)
            await task_repo.update_session_id(task_id, new_session_id)
            await db_sess.commit()

        # 프롬프트 구성
        delegate_prompt = prompt or task.description or task.title

        # 위임 이벤트 브로드캐스트
        await self.broadcast_team_event(
            team_id,
            {
                "type": WsEventType.TEAM_TASK_DELEGATED,
                "task_id": task_id,
                "task_title": task.title,
                "member_id": target_member_id,
                "member_nickname": member.nickname,
                "session_id": new_session_id,
            },
        )

        # 메시지 저장 + 전송
        ts = datetime.now(timezone.utc).isoformat()
        await self._session_manager.add_message(
            session_id=new_session_id,
            role="user",
            content=delegate_prompt,
            timestamp=ts,
        )
        await self._ws_manager.broadcast_event(
            new_session_id,
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
        from app.api.dependencies import get_mcp_service, get_settings_service

        settings_service = get_settings_service()
        global_settings = await settings_service.get()

        merged_session = dict(session_data)
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

        allowed_tools = (
            session_data.get("allowed_tools")
            or global_settings.get("allowed_tools")
            or ""
        )
        mcp_service = get_mcp_service()

        runner_task = asyncio.create_task(
            self._claude_runner.run(
                merged_session,
                delegate_prompt,
                allowed_tools,
                new_session_id,
                self._ws_manager,
                self._session_manager,
                mcp_service=mcp_service,
            )
        )

        def _on_done(t, sid=new_session_id):
            self._session_manager.clear_runner_task(sid)

        runner_task.add_done_callback(_on_done)
        self._session_manager.set_runner_task(new_session_id, runner_task)

        return {
            "task_id": task_id,
            "member_id": target_member_id,
            "session_id": new_session_id,
            "status": "delegated",
        }

    # ── 세션 완료 콜백 ──

    async def on_session_completed(
        self, session_id: str, last_text: str | None = None
    ) -> None:
        """세션 runner 완료 시 호출. 태스크의 session_id로 역조회하여 자동 완료."""
        async with self._db.session() as db_session:
            task_repo = TeamTaskRepository(db_session)
            # session_id로 진행 중인 태스크 역조회
            task = await task_repo.get_by_session_id(session_id)
            if not task:
                return

            # 결과 요약 추출
            result_summary = None
            if last_text:
                result_summary = last_text[:200]
                if len(last_text) > 200:
                    result_summary += "…"

            # 태스크 완료 처리
            task = await task_repo.complete_task(task.id, result_summary)
            await db_session.commit()

            logger.info(
                "팀 %s 태스크 %d 자동 완료 (세션 %s)",
                task.team_id,
                task.id,
                session_id,
            )

            # 팀 이벤트 브로드캐스트
            await self.broadcast_team_event(
                task.team_id,
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
        """세션이 팀 리드의 세션인지 확인 → 팀 컨텍스트 반환.

        session_id → TeamTask.session_id 역조회 → member → team.lead_member_id 비교
        """
        async with self._db.session() as db_session:
            task_repo = TeamTaskRepository(db_session)
            # session_id로 태스크 역조회
            tasks = await task_repo.get_tasks_by_session_id(session_id)
            if not tasks:
                return None

            task = tasks[0]
            team_repo = TeamRepository(db_session)
            team = await team_repo.get_by_id(task.team_id)
            if not team or not team.lead_member_id:
                return None

            # 이 태스크의 멤버가 리드인지 확인
            if task.assigned_member_id != team.lead_member_id:
                return None

            # 리드 세션임 → 팀 컨텍스트 구성
            member_repo = TeamMemberRepository(db_session)
            members = await member_repo.get_members(task.team_id)
            all_tasks = await task_repo.list_by_team(task.team_id)

            # 멤버 정보 (페르소나 기반)
            member_lines = []
            for m in members:
                role_tag = " (리드)" if m.role == "lead" else ""
                desc = f" - {m.description}" if m.description else ""
                model_tag = f" [{m.model}]" if m.model else ""
                member_lines.append(f"- {m.nickname}{role_tag}{desc}{model_tag}")

            # 태스크 정보
            task_lines = []
            nickname_map = {m.id: m.nickname for m in members}
            for t in all_tasks:
                status_icon = {
                    "pending": "대기",
                    "in_progress": "진행중",
                    "completed": "완료",
                    "failed": "실패",
                }.get(t.status, t.status)
                assignee = ""
                if t.assigned_member_id:
                    assignee = f" ({nickname_map.get(t.assigned_member_id, '?')})"
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

    # ── 자동 위임 ──

    async def auto_delegate(
        self, team_id: str, nickname: str, description: str
    ) -> None:
        """@delegate 패턴 감지 시 태스크 생성 + 위임."""
        from app.services.team_task_service import TeamTaskService

        async with self._db.session() as db_session:
            member_repo = TeamMemberRepository(db_session)
            target = await member_repo.get_member_by_nickname(team_id, nickname)

        if not target:
            logger.warning(
                "팀 %s: @delegate 대상 '%s'을(를) 찾을 수 없습니다",
                team_id,
                nickname,
            )
            return

        # 리드 태스크의 work_dir 상속 (같은 팀의 최근 태스크에서)
        work_dir = "/tmp"
        async with self._db.session() as db_session:
            task_repo = TeamTaskRepository(db_session)
            existing_tasks = await task_repo.list_by_team(team_id)
            if existing_tasks:
                work_dir = existing_tasks[0].work_dir

        # 태스크 생성
        task_service = TeamTaskService(self._db)
        task_info = await task_service.create_task(
            team_id=team_id,
            title=description[:100],
            description=description,
            work_dir=work_dir,
            priority="medium",
            assigned_member_id=target.id,
        )

        # 위임 실행
        try:
            await self.delegate_task(
                team_id=team_id,
                task_id=task_info.id,
                member_id=target.id,
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
