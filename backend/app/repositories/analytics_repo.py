"""토큰 분석 Repository."""

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message
from app.models.session import Session


class AnalyticsRepository:
    """토큰 사용량 집계 쿼리."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_summary(self, start: str, end: str) -> dict:
        """기간 내 전체 토큰 요약 (assistant 메시지 기준).

        Args:
            start: 시작 타임스탬프 (ISO 문자열, 이상)
            end: 종료 타임스탬프 (ISO 문자열, 미만)
        """
        stmt = select(
            func.count().label("total_messages"),
            func.coalesce(func.sum(Message.input_tokens), 0).label(
                "total_input_tokens"
            ),
            func.coalesce(func.sum(Message.output_tokens), 0).label(
                "total_output_tokens"
            ),
            func.coalesce(func.sum(Message.cache_read_tokens), 0).label(
                "total_cache_read_tokens"
            ),
            func.coalesce(func.sum(Message.cache_creation_tokens), 0).label(
                "total_cache_creation_tokens"
            ),
            func.count(func.distinct(Message.session_id)).label("total_sessions"),
        ).where(
            Message.role == "assistant",
            Message.timestamp >= start,
            Message.timestamp < end,
        )
        result = await self._session.execute(stmt)
        row = result.one()
        return dict(row._mapping)

    async def get_daily_usage(self, start: str, end: str) -> list[dict]:
        """일별 토큰 사용량 집계.

        Args:
            start: 시작 타임스탬프 (ISO 문자열, 이상)
            end: 종료 타임스탬프 (ISO 문자열, 미만)
        """
        # PostgreSQL: LEFT(timestamp, 10)으로 날짜 추출 (ISO 문자열 기반)
        date_col = func.left(Message.timestamp, 10).label("date")
        stmt = (
            select(
                date_col,
                func.coalesce(func.sum(Message.input_tokens), 0).label(
                    "input_tokens"
                ),
                func.coalesce(func.sum(Message.output_tokens), 0).label(
                    "output_tokens"
                ),
                func.coalesce(func.sum(Message.cache_read_tokens), 0).label(
                    "cache_read_tokens"
                ),
                func.coalesce(func.sum(Message.cache_creation_tokens), 0).label(
                    "cache_creation_tokens"
                ),
                func.count(func.distinct(Message.session_id)).label(
                    "active_sessions"
                ),
            )
            .where(
                Message.role == "assistant",
                Message.timestamp >= start,
                Message.timestamp < end,
            )
            .group_by(date_col)
            .order_by(date_col.asc())
        )
        result = await self._session.execute(stmt)
        return [dict(row._mapping) for row in result.all()]

    async def get_session_ranking(
        self, start: str, end: str, limit: int = 20
    ) -> list[dict]:
        """세션별 토큰 사용량 랭킹 (상위 N개).

        Args:
            start: 시작 타임스탬프 (ISO 문자열, 이상)
            end: 종료 타임스탬프 (ISO 문자열, 미만)
            limit: 상위 N개 세션
        """
        # 세션별 주 사용 모델 서브쿼리 (가장 많이 사용한 모델)
        model_sub = (
            select(
                Message.session_id,
                Message.model,
                func.count().label("model_cnt"),
            )
            .where(Message.model.isnot(None))
            .group_by(Message.session_id, Message.model)
            .subquery()
        )
        # ROW_NUMBER()로 세션별 최다 모델 선택
        top_model_sub = (
            select(
                model_sub.c.session_id,
                model_sub.c.model,
                func.row_number()
                .over(
                    partition_by=model_sub.c.session_id,
                    order_by=model_sub.c.model_cnt.desc(),
                )
                .label("rn"),
            ).subquery()
        )
        top_model = (
            select(top_model_sub.c.session_id, top_model_sub.c.model)
            .where(top_model_sub.c.rn == 1)
            .subquery()
        )

        stmt = (
            select(
                Message.session_id,
                Session.name.label("session_name"),
                Session.work_dir,
                func.coalesce(func.sum(Message.input_tokens), 0).label(
                    "input_tokens"
                ),
                func.coalesce(func.sum(Message.output_tokens), 0).label(
                    "output_tokens"
                ),
                (
                    func.coalesce(func.sum(Message.input_tokens), 0)
                    + func.coalesce(func.sum(Message.output_tokens), 0)
                ).label("total_tokens"),
                func.count().label("message_count"),
                top_model.c.model,
            )
            .join(Session, Message.session_id == Session.id)
            .outerjoin(top_model, top_model.c.session_id == Message.session_id)
            .where(
                Message.role == "assistant",
                Message.timestamp >= start,
                Message.timestamp < end,
            )
            .group_by(
                Message.session_id,
                Session.name,
                Session.work_dir,
                top_model.c.model,
            )
            .order_by(text("total_tokens DESC"))
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [dict(row._mapping) for row in result.all()]

    async def get_project_usage(self, start: str, end: str) -> list[dict]:
        """프로젝트(work_dir)별 토큰 사용량 집계.

        Args:
            start: 시작 타임스탬프 (ISO 문자열, 이상)
            end: 종료 타임스탬프 (ISO 문자열, 미만)
        """
        stmt = (
            select(
                Session.work_dir,
                func.coalesce(func.sum(Message.input_tokens), 0).label(
                    "input_tokens"
                ),
                func.coalesce(func.sum(Message.output_tokens), 0).label(
                    "output_tokens"
                ),
                func.coalesce(func.sum(Message.cache_read_tokens), 0).label(
                    "cache_read_tokens"
                ),
                func.coalesce(func.sum(Message.cache_creation_tokens), 0).label(
                    "cache_creation_tokens"
                ),
                func.count(func.distinct(Message.session_id)).label("session_count"),
            )
            .join(Session, Message.session_id == Session.id)
            .where(
                Message.role == "assistant",
                Message.timestamp >= start,
                Message.timestamp < end,
            )
            .group_by(Session.work_dir)
            .order_by(
                text(
                    "(COALESCE(SUM(input_tokens), 0) "
                    "+ COALESCE(SUM(output_tokens), 0)) DESC"
                )
            )
        )
        result = await self._session.execute(stmt)
        return [dict(row._mapping) for row in result.all()]
