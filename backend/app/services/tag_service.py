"""세션 태그 관리 서비스."""

import logging
import uuid
from datetime import datetime, timezone

from app.core.database import Database
from app.schemas.tag import TagInfo

logger = logging.getLogger(__name__)


class TagService:
    """태그 CRUD 및 세션-태그 연결 관리."""

    def __init__(self, db: Database) -> None:
        self._db = db

    @staticmethod
    def _row_to_info(row: dict) -> TagInfo:
        return TagInfo(id=row["id"], name=row["name"], color=row["color"])

    async def list_tags(self) -> list[TagInfo]:
        rows = await self._db.list_tags()
        return [self._row_to_info(r) for r in rows]

    async def get_tag(self, tag_id: str) -> TagInfo | None:
        row = await self._db.get_tag(tag_id)
        return self._row_to_info(row) if row else None

    async def create_tag(self, name: str, color: str = "#6366f1") -> TagInfo:
        tag_id = str(uuid.uuid4())[:16]
        now = datetime.now(timezone.utc).isoformat()
        row = await self._db.create_tag(tag_id, name, color, now)
        return self._row_to_info(row)

    async def update_tag(
        self, tag_id: str, name: str | None = None, color: str | None = None
    ) -> TagInfo | None:
        row = await self._db.update_tag(tag_id, name=name, color=color)
        return self._row_to_info(row) if row else None

    async def delete_tag(self, tag_id: str) -> bool:
        return await self._db.delete_tag(tag_id)

    async def add_tags_to_session(self, session_id: str, tag_ids: list[str]) -> list[TagInfo]:
        now = datetime.now(timezone.utc).isoformat()
        for tag_id in tag_ids:
            await self._db.add_session_tag(session_id, tag_id, now)
        rows = await self._db.get_session_tags(session_id)
        return [self._row_to_info(r) for r in rows]

    async def remove_tag_from_session(self, session_id: str, tag_id: str) -> bool:
        return await self._db.remove_session_tag(session_id, tag_id)

    async def get_session_tags(self, session_id: str) -> list[TagInfo]:
        rows = await self._db.get_session_tags(session_id)
        return [self._row_to_info(r) for r in rows]

    async def get_tags_for_sessions(self, session_ids: list[str]) -> dict[str, list[TagInfo]]:
        raw = await self._db.get_tags_for_sessions(session_ids)
        return {
            sid: [self._row_to_info(r) for r in tags]
            for sid, tags in raw.items()
        }
