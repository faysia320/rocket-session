"""세션 검색/필터 서비스."""

from app.core.database import Database
from app.repositories.search_repo import SearchRepository
from app.repositories.tag_repo import TagRepository
from app.schemas.session import SessionInfo
from app.schemas.tag import TagInfo


class SearchService:
    """PostgreSQL tsvector 기반 세션 검색/필터/정렬/페이징 처리."""

    def __init__(self, db: Database):
        self._db = db

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
        async with self._db.session() as session:
            search_repo = SearchRepository(session)
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
                tag_repo = TagRepository(session)
                session_ids = [s["id"] for s in items_raw]
                tags_map = await tag_repo.get_tags_for_sessions(session_ids)

        # SessionInfo 변환
        items: list[SessionInfo] = []
        for s in items_raw:
            info = self._to_info(s)
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

    @staticmethod
    def _to_info(session: dict) -> SessionInfo:
        """dict -> SessionInfo 변환. JSONB 필드는 이미 Python 객체."""
        perm_tools = session.get("permission_required_tools")
        mcp_ids = session.get("mcp_server_ids")
        return SessionInfo(
            id=session["id"],
            claude_session_id=session.get("claude_session_id"),
            work_dir=session["work_dir"],
            status=session["status"],
            created_at=session["created_at"],
            message_count=session.get("message_count", 0),
            file_changes_count=session.get("file_changes_count", 0),
            allowed_tools=session.get("allowed_tools"),
            system_prompt=session.get("system_prompt"),
            timeout_seconds=session.get("timeout_seconds"),
            mode=session.get("mode", "normal"),
            permission_mode=bool(session.get("permission_mode", False)),
            permission_required_tools=perm_tools,
            name=session.get("name"),
            model=session.get("model"),
            max_turns=session.get("max_turns"),
            max_budget_usd=session.get("max_budget_usd"),
            system_prompt_mode=session.get("system_prompt_mode", "replace"),
            disallowed_tools=session.get("disallowed_tools"),
            mcp_server_ids=mcp_ids,
        )
