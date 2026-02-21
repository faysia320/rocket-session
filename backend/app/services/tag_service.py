"""세션 태그 관리 서비스."""

import logging
import uuid
from datetime import datetime, timezone

from app.core.database import Database
from app.models.tag import Tag
from app.repositories.tag_repo import TagRepository
from app.schemas.tag import TagInfo

logger = logging.getLogger(__name__)


class TagService:
    """태그 CRUD 및 세션-태그 연결 관리."""

    def __init__(self, db: Database) -> None:
        self._db = db

    @staticmethod
    def _entity_to_info(tag: Tag) -> TagInfo:
        return TagInfo(id=tag.id, name=tag.name, color=tag.color)

    @staticmethod
    def _dict_to_info(row: dict) -> TagInfo:
        return TagInfo(id=row["id"], name=row["name"], color=row["color"])

    async def list_tags(self) -> list[TagInfo]:
        async with self._db.session() as session:
            repo = TagRepository(session)
            tags = await repo.list_all()
            return [self._entity_to_info(t) for t in tags]

    async def get_tag(self, tag_id: str) -> TagInfo | None:
        async with self._db.session() as session:
            repo = TagRepository(session)
            tag = await repo.get_by_id(tag_id)
            return self._entity_to_info(tag) if tag else None

    async def create_tag(self, name: str, color: str = "#6366f1") -> TagInfo:
        tag_id = str(uuid.uuid4())[:16]
        now = datetime.now(timezone.utc).isoformat()
        async with self._db.session() as session:
            repo = TagRepository(session)
            tag = Tag(id=tag_id, name=name, color=color, created_at=now)
            await repo.add(tag)
            await session.commit()
            return self._entity_to_info(tag)

    async def update_tag(
        self, tag_id: str, name: str | None = None, color: str | None = None
    ) -> TagInfo | None:
        kwargs = {}
        if name is not None:
            kwargs["name"] = name
        if color is not None:
            kwargs["color"] = color
        async with self._db.session() as session:
            repo = TagRepository(session)
            tag = await repo.update_tag(tag_id, **kwargs)
            await session.commit()
            return self._entity_to_info(tag) if tag else None

    async def delete_tag(self, tag_id: str) -> bool:
        async with self._db.session() as session:
            repo = TagRepository(session)
            deleted = await repo.delete_by_id(tag_id)
            await session.commit()
            return deleted

    async def add_tags_to_session(self, session_id: str, tag_ids: list[str]) -> list[TagInfo]:
        now = datetime.now(timezone.utc).isoformat()
        async with self._db.session() as session:
            repo = TagRepository(session)
            for tag_id in tag_ids:
                await repo.add_session_tag(session_id, tag_id, now)
            await session.commit()
            rows = await repo.get_session_tags(session_id)
            return [self._dict_to_info(r) for r in rows]

    async def remove_tag_from_session(self, session_id: str, tag_id: str) -> bool:
        async with self._db.session() as session:
            repo = TagRepository(session)
            removed = await repo.remove_session_tag(session_id, tag_id)
            await session.commit()
            return removed

    async def get_session_tags(self, session_id: str) -> list[TagInfo]:
        async with self._db.session() as session:
            repo = TagRepository(session)
            rows = await repo.get_session_tags(session_id)
            return [self._dict_to_info(r) for r in rows]

    async def get_tags_for_sessions(self, session_ids: list[str]) -> dict[str, list[TagInfo]]:
        async with self._db.session() as session:
            repo = TagRepository(session)
            raw = await repo.get_tags_for_sessions(session_ids)
            return {
                sid: [self._dict_to_info(r) for r in tags]
                for sid, tags in raw.items()
            }
