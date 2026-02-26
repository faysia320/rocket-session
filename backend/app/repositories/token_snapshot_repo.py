"""토큰 스냅샷 Repository — 세션 삭제와 무관한 토큰 사용량 집계."""

from datetime import datetime

from sqlalchemy import cast, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import Date

from app.models.session import Session
from app.models.token_snapshot import TokenSnapshot


class TokenSnapshotRepository:
    """token_snapshots 테이블 CRUD 및 집계 쿼리."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def add(self, snapshot: TokenSnapshot) -> None:
        """스냅샷 저장."""
        self._session.add(snapshot)
        await self._session.commit()

    async def get_summary(self, start: datetime, end: datetime) -> dict:
        """기간 내 전체 토큰 요약."""
        stmt = select(
            func.count().label("total_messages"),
            func.coalesce(func.sum(TokenSnapshot.input_tokens), 0).label(
                "total_input_tokens"
            ),
            func.coalesce(func.sum(TokenSnapshot.output_tokens), 0).label(
                "total_output_tokens"
            ),
            func.coalesce(func.sum(TokenSnapshot.cache_read_tokens), 0).label(
                "total_cache_read_tokens"
            ),
            func.coalesce(func.sum(TokenSnapshot.cache_creation_tokens), 0).label(
                "total_cache_creation_tokens"
            ),
            func.count(func.distinct(TokenSnapshot.session_id)).label(
                "total_sessions"
            ),
        ).where(
            TokenSnapshot.timestamp >= start,
            TokenSnapshot.timestamp < end,
        )
        result = await self._session.execute(stmt)
        row = result.one()
        return dict(row._mapping)

    async def get_daily_usage(
        self, start: datetime, end: datetime
    ) -> list[dict]:
        """일별 토큰 사용량 집계."""
        date_col = cast(TokenSnapshot.timestamp, Date).label("date")
        stmt = (
            select(
                date_col,
                func.coalesce(func.sum(TokenSnapshot.input_tokens), 0).label(
                    "input_tokens"
                ),
                func.coalesce(func.sum(TokenSnapshot.output_tokens), 0).label(
                    "output_tokens"
                ),
                func.coalesce(func.sum(TokenSnapshot.cache_read_tokens), 0).label(
                    "cache_read_tokens"
                ),
                func.coalesce(func.sum(TokenSnapshot.cache_creation_tokens), 0).label(
                    "cache_creation_tokens"
                ),
                func.count(func.distinct(TokenSnapshot.session_id)).label(
                    "active_sessions"
                ),
            )
            .where(
                TokenSnapshot.timestamp >= start,
                TokenSnapshot.timestamp < end,
            )
            .group_by(date_col)
            .order_by(date_col.asc())
        )
        result = await self._session.execute(stmt)
        return [dict(row._mapping) for row in result.all()]

    async def get_session_ranking(
        self, start: datetime, end: datetime, limit: int = 20
    ) -> list[dict]:
        """세션별 토큰 사용량 랭킹 (상위 N개).

        삭제된 세션도 표시하기 위해 sessions 테이블과 LEFT JOIN.
        """
        # 세션별 주 사용 모델 서브쿼리
        model_count_sub = (
            select(
                TokenSnapshot.session_id,
                TokenSnapshot.model,
                func.count().label("cnt"),
            )
            .where(
                TokenSnapshot.model.isnot(None),
                TokenSnapshot.timestamp >= start,
                TokenSnapshot.timestamp < end,
            )
            .group_by(TokenSnapshot.session_id, TokenSnapshot.model)
            .subquery()
        )
        top_model = (
            select(
                model_count_sub.c.session_id,
                model_count_sub.c.model,
            )
            .distinct(model_count_sub.c.session_id)
            .order_by(
                model_count_sub.c.session_id,
                model_count_sub.c.cnt.desc(),
            )
            .subquery()
        )

        stmt = (
            select(
                TokenSnapshot.session_id,
                Session.name.label("session_name"),
                TokenSnapshot.work_dir,
                func.coalesce(func.sum(TokenSnapshot.input_tokens), 0).label(
                    "input_tokens"
                ),
                func.coalesce(func.sum(TokenSnapshot.output_tokens), 0).label(
                    "output_tokens"
                ),
                (
                    func.coalesce(func.sum(TokenSnapshot.input_tokens), 0)
                    + func.coalesce(func.sum(TokenSnapshot.output_tokens), 0)
                ).label("total_tokens"),
                func.count().label("message_count"),
                top_model.c.model,
            )
            .outerjoin(Session, TokenSnapshot.session_id == Session.id)
            .outerjoin(
                top_model, top_model.c.session_id == TokenSnapshot.session_id
            )
            .where(
                TokenSnapshot.timestamp >= start,
                TokenSnapshot.timestamp < end,
            )
            .group_by(
                TokenSnapshot.session_id,
                Session.name,
                TokenSnapshot.work_dir,
                top_model.c.model,
            )
            .order_by(text("total_tokens DESC"))
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [dict(row._mapping) for row in result.all()]

    async def get_project_usage(
        self, start: datetime, end: datetime
    ) -> list[dict]:
        """프로젝트(work_dir)별 토큰 사용량 집계.

        token_snapshots에 work_dir이 있으므로 sessions JOIN 불필요.
        """
        stmt = (
            select(
                TokenSnapshot.work_dir,
                func.coalesce(func.sum(TokenSnapshot.input_tokens), 0).label(
                    "input_tokens"
                ),
                func.coalesce(func.sum(TokenSnapshot.output_tokens), 0).label(
                    "output_tokens"
                ),
                func.coalesce(func.sum(TokenSnapshot.cache_read_tokens), 0).label(
                    "cache_read_tokens"
                ),
                func.coalesce(func.sum(TokenSnapshot.cache_creation_tokens), 0).label(
                    "cache_creation_tokens"
                ),
                func.count(func.distinct(TokenSnapshot.session_id)).label(
                    "session_count"
                ),
            )
            .where(
                TokenSnapshot.timestamp >= start,
                TokenSnapshot.timestamp < end,
            )
            .group_by(TokenSnapshot.work_dir)
            .order_by(
                text(
                    "(COALESCE(SUM(input_tokens), 0) "
                    "+ COALESCE(SUM(output_tokens), 0)) DESC"
                )
            )
        )
        result = await self._session.execute(stmt)
        return [dict(row._mapping) for row in result.all()]

    async def get_phase_usage(
        self, start: datetime, end: datetime
    ) -> list[dict]:
        """워크플로우 Phase별 토큰 사용량 집계."""
        stmt = (
            select(
                TokenSnapshot.workflow_phase,
                func.coalesce(func.sum(TokenSnapshot.input_tokens), 0).label(
                    "input_tokens"
                ),
                func.coalesce(func.sum(TokenSnapshot.output_tokens), 0).label(
                    "output_tokens"
                ),
                func.coalesce(func.sum(TokenSnapshot.cache_read_tokens), 0).label(
                    "cache_read_tokens"
                ),
                func.coalesce(func.sum(TokenSnapshot.cache_creation_tokens), 0).label(
                    "cache_creation_tokens"
                ),
                func.count().label("turn_count"),
            )
            .where(
                TokenSnapshot.timestamp >= start,
                TokenSnapshot.timestamp < end,
                TokenSnapshot.workflow_phase.isnot(None),
            )
            .group_by(TokenSnapshot.workflow_phase)
            .order_by(
                text(
                    "(COALESCE(SUM(input_tokens), 0) "
                    "+ COALESCE(SUM(output_tokens), 0)) DESC"
                )
            )
        )
        result = await self._session.execute(stmt)
        return [dict(row._mapping) for row in result.all()]

    async def get_session_phase_usage(
        self, start: datetime, end: datetime, limit: int = 10
    ) -> list[dict]:
        """세션별 Phase 교차 토큰 사용량 (상위 N세션)."""
        # 서브쿼리: 기간 내 총 토큰 기준 상위 N 세션
        top_sessions = (
            select(
                TokenSnapshot.session_id,
                (
                    func.coalesce(func.sum(TokenSnapshot.input_tokens), 0)
                    + func.coalesce(func.sum(TokenSnapshot.output_tokens), 0)
                ).label("total"),
            )
            .where(
                TokenSnapshot.timestamp >= start,
                TokenSnapshot.timestamp < end,
            )
            .group_by(TokenSnapshot.session_id)
            .order_by(text("total DESC"))
            .limit(limit)
            .subquery()
        )

        # 메인 쿼리: top 세션들의 (session_id, workflow_phase) 그룹별 집계
        stmt = (
            select(
                TokenSnapshot.session_id,
                Session.name.label("session_name"),
                TokenSnapshot.workflow_phase,
                func.coalesce(func.sum(TokenSnapshot.input_tokens), 0).label(
                    "input_tokens"
                ),
                func.coalesce(func.sum(TokenSnapshot.output_tokens), 0).label(
                    "output_tokens"
                ),
                (
                    func.coalesce(func.sum(TokenSnapshot.input_tokens), 0)
                    + func.coalesce(func.sum(TokenSnapshot.output_tokens), 0)
                ).label("total_tokens"),
            )
            .join(top_sessions, TokenSnapshot.session_id == top_sessions.c.session_id)
            .outerjoin(Session, TokenSnapshot.session_id == Session.id)
            .where(
                TokenSnapshot.timestamp >= start,
                TokenSnapshot.timestamp < end,
                TokenSnapshot.workflow_phase.isnot(None),
            )
            .group_by(
                TokenSnapshot.session_id,
                Session.name,
                TokenSnapshot.workflow_phase,
            )
            .order_by(top_sessions.c.total.desc(), TokenSnapshot.workflow_phase)
        )
        result = await self._session.execute(stmt)
        return [dict(row._mapping) for row in result.all()]
