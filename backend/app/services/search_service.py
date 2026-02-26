"""세션 검색/필터 서비스."""

from app.repositories.search_repo import SearchRepository
from app.repositories.tag_repo import TagRepository
from app.schemas.session import SessionInfo
from app.schemas.tag import TagInfo
from app.services.base import DBService


class SearchService(DBService):
    """PostgreSQL tsvector 기반 세션 검색/필터/정렬/페이징 처리."""

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
        include_tags: bool = False,
    ) -> dict:
        async with self._session_scope(SearchRepository, TagRepository) as (
            session, search_repo, tag_repo,
        ):
            items_raw, total = await search_repo.search_sessions(
                q=q,
                fts_query=fts_query,
                status=status,
                model=model,
                work_dir=work_dir,
                tag_ids=tag_ids,
                date_from=date_from,
                date_to=date_to,
                sort=sort,
                order=order,
                limit=limit,
                offset=offset,
            )

            # 태그 포함
            tags_map: dict[str, list[dict]] = {}
            if include_tags and items_raw:
                session_ids = [s["id"] for s in items_raw]
                tags_map = await tag_repo.get_tags_for_sessions(session_ids)

        # SessionInfo 변환
        items: list[SessionInfo] = []
        for s in items_raw:
            info = SessionInfo.model_validate(s)
            if include_tags:
                tags_data = tags_map.get(s["id"], [])
                info.tags = [TagInfo(**t) for t in tags_data]
            items.append(info)

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
        }
