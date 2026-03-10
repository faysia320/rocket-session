"""세션 분석 서비스 — Events + TokenSnapshots 기반 세션 요약 및 자동 인사이트 생성."""

import structlog

from app.core.database import Database
from app.core.utils import utc_now
from app.models.workspace_insight import WorkspaceInsight
from app.repositories.event_repo import EventRepository
from app.repositories.workspace_insight_repo import WorkspaceInsightRepository
from app.schemas.session_analysis import SessionSummary, TokenSummary
from app.services.base import DBService

logger = structlog.get_logger(__name__)


class SessionAnalysisService(DBService):
    """세션 완료 시 이벤트 데이터를 분석하여 요약 및 인사이트를 생성."""

    # 자동 인사이트 생성 임계값
    HIGH_COST_THRESHOLD_USD = 0.50
    HIGH_TOOL_USE_THRESHOLD = 20
    MAX_AUTO_INSIGHTS_PER_WORKSPACE = 20

    def __init__(self, db: Database) -> None:
        super().__init__(db)

    async def generate_session_summary(self, session_id: str) -> SessionSummary:
        """Events 테이블에서 세션의 전체 이벤트를 읽어 구조화된 요약 생성."""
        async with self._session_scope(EventRepository) as (_session, repo):
            events = await repo.get_all_events(session_id)

        summary = SessionSummary(session_id=session_id)
        if not events:
            return summary

        # 시간 범위
        summary.started_at = events[0].get("timestamp")
        summary.ended_at = events[-1].get("timestamp")
        if summary.started_at and summary.ended_at:
            delta = summary.ended_at - summary.started_at
            summary.duration_seconds = int(delta.total_seconds())

        tools_used: dict[str, int] = {}
        phases_seen: list[str] = []
        total_tokens = TokenSummary()
        total_cost = 0.0
        turn_count = 0
        error_count = 0
        stall_count = 0
        retry_count = 0
        ask_count = 0
        original_prompt = ""

        for event in events:
            event_type = event.get("event_type", "")
            payload = event.get("payload") or {}

            if event_type == "user_message":
                turn_count += 1
                msg = payload.get("message", {})
                if isinstance(msg, dict) and not original_prompt:
                    original_prompt = (msg.get("content", "") or "")[:200]

            elif event_type == "tool_use":
                tool = payload.get("tool", "")
                if tool:
                    tools_used[tool] = tools_used.get(tool, 0) + 1

            elif event_type == "result":
                input_tokens = payload.get("input_tokens") or 0
                output_tokens = payload.get("output_tokens") or 0
                cache_read = payload.get("cache_read_tokens") or 0
                cache_create = payload.get("cache_creation_tokens") or 0
                cost = payload.get("cost") or 0.0

                total_tokens.input += input_tokens
                total_tokens.output += output_tokens
                total_tokens.cache_read += cache_read
                total_tokens.cache_create += cache_create
                if isinstance(cost, (int, float)):
                    total_cost += cost

                if payload.get("is_error"):
                    error_count += 1

                phase = payload.get("workflow_phase")
                if phase and phase not in phases_seen:
                    phases_seen.append(phase)

            elif event_type == "stall_detected":
                stall_count += 1

            elif event_type == "retry_attempt":
                retry_count += 1

            elif event_type == "ask_user_question":
                ask_count += 1

            elif event_type == "workflow_started":
                summary.workflow_enabled = True

            elif event_type == "workflow_completed":
                summary.workflow_completed = True

        summary.turn_count = turn_count
        summary.tools_used = tools_used
        summary.total_tokens = total_tokens
        summary.total_cost_usd = round(total_cost, 6)
        summary.error_count = error_count
        summary.stall_count = stall_count
        summary.retry_count = retry_count
        summary.ask_user_question_count = ask_count
        summary.workflow_phases_traversed = phases_seen
        summary.original_prompt = original_prompt

        return summary

    async def generate_auto_insights(
        self, session_id: str, workspace_id: str
    ) -> list[WorkspaceInsight]:
        """세션 요약을 기반으로 자동 인사이트를 생성하여 DB에 저장."""
        summary = await self.generate_session_summary(session_id)
        if not summary.turn_count:
            return []

        insights_data: list[dict] = []
        now = utc_now()

        # 규칙 1: 에러 발생
        if summary.error_count > 0:
            insights_data.append({
                "category": "gotcha",
                "title": f"세션 에러 {summary.error_count}건 발생",
                "content": (
                    f"세션 `{session_id}`에서 {summary.error_count}건의 에러가 발생했습니다. "
                    f"총 {summary.turn_count}턴, 비용 ${summary.total_cost_usd:.4f}."
                ),
                "relevance_score": 0.8,
                "tags": ["auto", "error"],
            })

        # 규칙 2: Stall 감지
        if summary.stall_count > 0:
            insights_data.append({
                "category": "gotcha",
                "title": f"Stall {summary.stall_count}회 감지",
                "content": (
                    f"세션 `{session_id}`에서 무응답(stall)이 {summary.stall_count}회 감지되었습니다. "
                    "타임아웃 설정 또는 프롬프트 복잡도를 검토하세요."
                ),
                "relevance_score": 0.7,
                "tags": ["auto", "stall"],
            })

        # 규칙 3: 고비용 세션
        if summary.total_cost_usd > self.HIGH_COST_THRESHOLD_USD:
            insights_data.append({
                "category": "session_analysis",
                "title": f"고비용 세션 (${summary.total_cost_usd:.2f})",
                "content": (
                    f"세션 `{session_id}` 비용: ${summary.total_cost_usd:.4f}. "
                    f"토큰: 입력 {summary.total_tokens.input:,}, "
                    f"출력 {summary.total_tokens.output:,}, "
                    f"캐시읽기 {summary.total_tokens.cache_read:,}. "
                    "캐시 활용률을 높이면 비용을 절감할 수 있습니다."
                ),
                "relevance_score": 0.6,
                "tags": ["auto", "cost"],
            })

        # 규칙 4: 워크플로우 완료
        if summary.workflow_completed:
            phases_str = " → ".join(summary.workflow_phases_traversed)
            insights_data.append({
                "category": "session_analysis",
                "title": "워크플로우 완료",
                "content": (
                    f"세션 `{session_id}` 워크플로우 완료. "
                    f"단계: {phases_str}. "
                    f"총 {summary.turn_count}턴, 비용 ${summary.total_cost_usd:.4f}, "
                    f"소요시간 {summary.duration_seconds}초."
                ),
                "relevance_score": 0.5,
                "tags": ["auto", "workflow"],
            })

        # 규칙 5: 특정 도구 다빈도 사용
        for tool_name, count in summary.tools_used.items():
            if count >= self.HIGH_TOOL_USE_THRESHOLD:
                insights_data.append({
                    "category": "pattern",
                    "title": f"{tool_name} 다빈도 사용 ({count}회)",
                    "content": (
                        f"세션 `{session_id}`에서 `{tool_name}` 도구를 {count}회 사용했습니다. "
                        "반복적인 작업이라면 자동화 방안을 검토하세요."
                    ),
                    "relevance_score": 0.5,
                    "tags": ["auto", "tool-pattern"],
                })

        if not insights_data:
            return []

        # 오래된 자동 인사이트 정리
        await self._cleanup_old_auto_insights(workspace_id)

        # 인사이트 저장
        created: list[WorkspaceInsight] = []
        async with self._session_scope(WorkspaceInsightRepository) as (session, repo):
            for data in insights_data:
                entity = WorkspaceInsight(
                    workspace_id=workspace_id,
                    session_id=session_id,
                    category=data["category"],
                    title=data["title"],
                    content=data["content"],
                    relevance_score=data["relevance_score"],
                    tags=data.get("tags"),
                    is_auto_generated=True,
                    created_at=now,
                    updated_at=now,
                )
                await repo.add(entity)
                created.append(entity)
            await session.commit()

        logger.info(
            "자동 인사이트 생성 완료",
            component="session",
            operation="auto_insights",
            count=len(created),
            workspace_id=workspace_id,
        )
        return created

    async def _cleanup_old_auto_insights(self, workspace_id: str) -> None:
        """워크스페이스당 자동 인사이트가 max_count 초과 시 오래된 것부터 아카이브."""
        async with self._session_scope(WorkspaceInsightRepository) as (session, repo):
            # 자동 생성 인사이트만 조회
            all_insights = await repo.list_by_workspace(
                workspace_id, include_archived=False, limit=200
            )
            auto_insights = [i for i in all_insights if i.is_auto_generated]

            if len(auto_insights) <= self.MAX_AUTO_INSIGHTS_PER_WORKSPACE:
                return

            # 오래된 것부터 아카이브 (created_at 기준)
            sorted_by_date = sorted(auto_insights, key=lambda i: i.created_at)
            excess = len(auto_insights) - self.MAX_AUTO_INSIGHTS_PER_WORKSPACE
            ids_to_archive = [i.id for i in sorted_by_date[:excess]]

            if ids_to_archive:
                await repo.archive_by_ids(ids_to_archive)
                await session.commit()
                logger.info(
                    "오래된 자동 인사이트 아카이브",
                    component="session",
                    operation="cleanup_insights",
                    archived_count=len(ids_to_archive),
                    workspace_id=workspace_id,
                )
