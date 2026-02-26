"""세션 태그 관리 서비스."""

import logging
import uuid

from app.core.exceptions import ConflictError, NotFoundError
from app.core.utils import utc_now
from app.models.tag import Tag
from app.repositories.tag_repo import TagRepository
from app.schemas.tag import TagInfo
from app.services.base import DBService

logger = logging.getLogger(__name__)


class TagService(DBService):
    """태그 CRUD 및 세션-태그 연결 관리."""

    async def list_tags(self) -> list[TagInfo]:
        async with self._session_scope(TagRepository) as (session, repo):
            tags = await repo.get_all_ordered(Tag.name.asc())
            return [TagInfo.model_validate(t) for t in tags]

    async def get_tag(self, tag_id: str) -> TagInfo | None:
        async with self._session_scope(TagRepository) as (session, repo):
            tag = await repo.get_by_id(tag_id)
            return TagInfo.model_validate(tag) if tag else None

    async def create_tag(self, name: str, color: str = "#6366f1") -> TagInfo:
        tag_id = str(uuid.uuid4())[:16]
        now = utc_now()
        async with self._session_scope(TagRepository) as (session, repo):
            existing = await repo.get_by_name(name)
            if existing:
                raise ConflictError("이미 존재하는 태그 이름입니다")
            tag = Tag(id=tag_id, name=name, color=color, created_at=now)
            await repo.add(tag)
            await session.commit()
            return TagInfo.model_validate(tag)

    async def update_tag(
        self, tag_id: str, name: str | None = None, color: str | None = None
    ) -> TagInfo:
        kwargs = {}
        if name is not None:
            kwargs["name"] = name
        if color is not None:
            kwargs["color"] = color
        async with self._session_scope(TagRepository) as (session, repo):
            tag = await repo.update_by_id(tag_id, **kwargs)
            if not tag:
                raise NotFoundError(f"태그를 찾을 수 없습니다: {tag_id}")
            await session.commit()
            return TagInfo.model_validate(tag)

    async def delete_tag(self, tag_id: str) -> bool:
        async with self._session_scope(TagRepository) as (session, repo):
            deleted = await repo.delete_by_id(tag_id)
            if not deleted:
                raise NotFoundError(f"태그를 찾을 수 없습니다: {tag_id}")
            await session.commit()
            return True

    async def add_tags_to_session(
        self, session_id: str, tag_ids: list[str]
    ) -> list[TagInfo]:
        now = utc_now()
        async with self._session_scope(TagRepository) as (session, repo):
            for tag_id in tag_ids:
                await repo.add_session_tag(session_id, tag_id, now)
            await session.commit()
            rows = await repo.get_session_tags(session_id)
            return [TagInfo.model_validate(r) for r in rows]

    async def remove_tag_from_session(self, session_id: str, tag_id: str) -> bool:
        async with self._session_scope(TagRepository) as (session, repo):
            removed = await repo.remove_session_tag(session_id, tag_id)
            await session.commit()
            return removed

    async def get_session_tags(self, session_id: str) -> list[TagInfo]:
        async with self._session_scope(TagRepository) as (session, repo):
            rows = await repo.get_session_tags(session_id)
            return [TagInfo.model_validate(r) for r in rows]

    async def get_tags_for_sessions(
        self, session_ids: list[str]
    ) -> dict[str, list[TagInfo]]:
        async with self._session_scope(TagRepository) as (session, repo):
            raw = await repo.get_tags_for_sessions(session_ids)
            return {
                sid: [TagInfo.model_validate(r) for r in tags]
                for sid, tags in raw.items()
            }
