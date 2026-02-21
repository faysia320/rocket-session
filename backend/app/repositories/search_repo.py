"""세션 검색 Repository (PostgreSQL tsvector/tsquery 기반)."""

from sqlalchemy import func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.file_change import FileChange
from app.models.message import Message
from app.models.session import Session
from app.models.tag import SessionTag
from app.repositories.session_repo import _session_to_dict


class SearchRepository:
    """PostgreSQL tsvector 기반 세션 검색."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def search_sessions(
        self,
        *,
        q: str | None = None,
        fts_query: str | None = None,
        status: str | None = None,
        model: str | None = None,
        work_dir: str | None = None,
        tag_ids: list[str] | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        sort: str = "created_at",
        order: str = "desc",
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """세션 검색. (items, total) 튜플 반환.

        Args:
            q: LIKE 검색어 (이름/ID 부분 일치)
            fts_query: 전문 검색어 (tsvector/tsquery)
            status: 세션 상태 필터
            model: 모델명 필터
            work_dir: 작업 디렉토리 prefix 필터
            tag_ids: 태그 ID 목록 (AND 조건)
            date_from: 시작일 (ISO 문자열, 이상)
            date_to: 종료일 (ISO 문자열, 이하)
            sort: 정렬 기준 컬럼
            order: 정렬 방향 (asc/desc)
            limit: 조회 제한
            offset: 조회 시작 위치
        """
        # 메시지 수/파일 변경 수 서브쿼리
        msg_sub = (
            select(Message.session_id, func.count().label("cnt"))
            .group_by(Message.session_id)
            .subquery()
        )
        fc_sub = (
            select(FileChange.session_id, func.count().label("cnt"))
            .group_by(FileChange.session_id)
            .subquery()
        )

        base = (
            select(
                Session,
                func.coalesce(msg_sub.c.cnt, 0).label("message_count"),
                func.coalesce(fc_sub.c.cnt, 0).label("file_changes_count"),
            )
            .outerjoin(msg_sub, msg_sub.c.session_id == Session.id)
            .outerjoin(fc_sub, fc_sub.c.session_id == Session.id)
        )

        # 필터 조건 누적
        filters = []

        if fts_query:
            # PostgreSQL tsvector 전문 검색
            filters.append(
                Session.search_vector.op("@@")(
                    func.plainto_tsquery("simple", fts_query)
                )
            )
        elif q:
            # LIKE 부분 일치 검색 (이름 또는 ID)
            like_q = f"%{q}%"
            filters.append(
                (Session.name.ilike(like_q)) | (Session.id.ilike(like_q))
            )

        if status:
            filters.append(Session.status == status)
        if model:
            filters.append(Session.model == model)
        if work_dir:
            filters.append(Session.work_dir.startswith(work_dir))
        if date_from:
            filters.append(Session.created_at >= date_from)
        if date_to:
            filters.append(Session.created_at <= date_to)

        if tag_ids:
            # 태그 AND 필터: 모든 태그를 가진 세션만 반환
            tag_sub = (
                select(SessionTag.session_id)
                .where(SessionTag.tag_id.in_(tag_ids))
                .group_by(SessionTag.session_id)
                .having(func.count(func.distinct(SessionTag.tag_id)) == len(tag_ids))
                .subquery()
            )
            filters.append(Session.id.in_(select(tag_sub.c.session_id)))

        if filters:
            base = base.where(*filters)

        # 총 개수 조회
        count_stmt = select(func.count()).select_from(base.subquery())
        total = (await self._session.execute(count_stmt)).scalar_one()

        # 정렬 컬럼 결정
        allowed_sorts = {"created_at", "name", "status", "model"}
        if sort == "message_count":
            order_col = literal_column("message_count")
        elif sort in allowed_sorts:
            order_col = getattr(Session, sort)
        else:
            order_col = Session.created_at

        if order.lower() == "asc":
            base = base.order_by(order_col.asc())
        else:
            base = base.order_by(order_col.desc())

        base = base.limit(limit).offset(offset)

        result = await self._session.execute(base)
        rows = result.all()

        items = [
            {
                **_session_to_dict(row[0]),
                "message_count": row[1],
                "file_changes_count": row[2],
            }
            for row in rows
        ]
        return items, total
