"""세션 검색/필터 서비스."""

from app.core.database import Database
from app.schemas.session import SessionInfo, CurrentActivity
from app.schemas.tag import TagInfo
import json


class SearchService:
    """동적 SQL 빌드로 세션 검색/필터/정렬/페이징 처리."""

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
        """세션 검색 결과를 반환합니다.

        Returns:
            dict: { items: list[SessionInfo], total: int, limit: int, offset: int }
        """
        # 기본 쿼리
        base_select = """
            SELECT s.*,
                   COALESCE(mc.cnt, 0) as message_count,
                   COALESCE(fc.cnt, 0) as file_changes_count
            FROM sessions s
            LEFT JOIN (SELECT session_id, COUNT(*) as cnt FROM messages GROUP BY session_id) mc
              ON mc.session_id = s.id
            LEFT JOIN (SELECT session_id, COUNT(*) as cnt FROM file_changes GROUP BY session_id) fc
              ON fc.session_id = s.id
        """

        where_clauses: list[str] = []
        params: list = []

        # 전문 검색 (FTS5) - q보다 우선
        if fts_query:
            fts_terms = " ".join(
                f"{term}*" if not term.endswith("*") else term
                for term in fts_query.split()
                if term.strip()
            )
            if fts_terms:
                where_clauses.append(
                    "s.id IN (SELECT DISTINCT session_id FROM sessions_fts WHERE sessions_fts MATCH ?)"
                )
                params.append(fts_terms)
        # 검색어 (이름 또는 ID LIKE) - FTS가 없으면 LIKE 폴백
        elif q:
            where_clauses.append(
                "(s.name LIKE ? OR s.id LIKE ?)"
            )
            like_q = f"%{q}%"
            params.extend([like_q, like_q])

        # 상태 필터
        if status:
            where_clauses.append("s.status = ?")
            params.append(status)

        # 모델 필터
        if model:
            where_clauses.append("s.model = ?")
            params.append(model)

        # 작업 디렉토리 prefix match
        if work_dir:
            where_clauses.append("s.work_dir LIKE ?")
            params.append(f"{work_dir}%")

        # 날짜 범위
        if date_from:
            where_clauses.append("s.created_at >= ?")
            params.append(date_from)
        if date_to:
            where_clauses.append("s.created_at <= ?")
            params.append(date_to)

        # 태그 필터 (AND 조건: 모든 태그를 가진 세션만)
        if tag_ids:
            where_clauses.append(
                f"""s.id IN (
                    SELECT session_id FROM session_tags
                    WHERE tag_id IN ({','.join('?' * len(tag_ids))})
                    GROUP BY session_id
                    HAVING COUNT(DISTINCT tag_id) = ?
                )"""
            )
            params.extend(tag_ids)
            params.append(len(tag_ids))

        # WHERE 절 조합
        where_sql = ""
        if where_clauses:
            where_sql = " WHERE " + " AND ".join(where_clauses)

        # 정렬 (허용된 컬럼만)
        allowed_sorts = {"created_at", "name", "message_count", "status", "model"}
        sort_col = sort if sort in allowed_sorts else "created_at"
        order_dir = "ASC" if order.lower() == "asc" else "DESC"

        # 총 개수 쿼리
        count_sql = f"SELECT COUNT(*) FROM ({base_select}{where_sql})"
        cursor = await self._db.read_conn.execute(count_sql, params)
        row = await cursor.fetchone()
        total = row[0] if row else 0

        # 결과 쿼리
        if sort_col == "message_count":
            order_clause = f"message_count {order_dir}"
        else:
            order_clause = f"s.{sort_col} {order_dir}"

        result_sql = f"{base_select}{where_sql} ORDER BY {order_clause} LIMIT ? OFFSET ?"
        result_params = params + [limit, offset]
        cursor = await self._db.read_conn.execute(result_sql, result_params)
        rows = await cursor.fetchall()
        sessions = [dict(r) for r in rows]

        # 태그 포함
        if include_tags and sessions:
            session_ids = [s["id"] for s in sessions]
            tags_map = await self._db.get_tags_for_sessions(session_ids)
        else:
            tags_map = {}

        # SessionInfo 변환
        items: list[SessionInfo] = []
        for s in sessions:
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
        """dict → SessionInfo 변환 (SessionManager.to_info와 동일 로직)."""
        perm_tools_raw = session.get("permission_required_tools")
        perm_tools = None
        if perm_tools_raw:
            try:
                perm_tools = json.loads(perm_tools_raw)
            except (json.JSONDecodeError, TypeError):
                perm_tools = None
        mcp_ids_raw = session.get("mcp_server_ids")
        mcp_ids = None
        if mcp_ids_raw:
            try:
                mcp_ids = json.loads(mcp_ids_raw)
            except (json.JSONDecodeError, TypeError):
                mcp_ids = None
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
            permission_mode=bool(session.get("permission_mode", 0)),
            permission_required_tools=perm_tools,
            name=session.get("name"),
            model=session.get("model"),
            max_turns=session.get("max_turns"),
            max_budget_usd=session.get("max_budget_usd"),
            system_prompt_mode=session.get("system_prompt_mode", "replace"),
            disallowed_tools=session.get("disallowed_tools"),
            mcp_server_ids=mcp_ids,
        )
