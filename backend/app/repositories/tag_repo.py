"""태그 Repository."""

from sqlalchemy import delete, select

from app.models.tag import SessionTag, Tag
from app.repositories.base import BaseRepository


class TagRepository(BaseRepository[Tag]):
    """tags + session_tags 테이블 CRUD."""

    model_class = Tag

    async def get_by_name(self, name: str) -> Tag | None:
        """태그 이름으로 조회."""
        result = await self._session.execute(
            select(Tag).where(Tag.name == name)
        )
        return result.scalar_one_or_none()

    async def list_all(self) -> list[Tag]:
        """전체 태그 목록 (이름순)."""
        result = await self._session.execute(
            select(Tag).order_by(Tag.name.asc())
        )
        return list(result.scalars().all())

    async def update_tag(self, tag_id: str, **kwargs) -> Tag | None:
        """태그 속성 업데이트. kwargs에 있는 필드만 변경."""
        tag = await self.get_by_id(tag_id)
        if not tag:
            return None
        for key, value in kwargs.items():
            setattr(tag, key, value)
        await self._session.flush()
        return tag

    # ── 세션-태그 연결 ──

    async def add_session_tag(
        self, session_id: str, tag_id: str, created_at: str
    ) -> None:
        """세션-태그 연결 추가 (중복 무시)."""
        existing = await self._session.execute(
            select(SessionTag).where(
                SessionTag.session_id == session_id,
                SessionTag.tag_id == tag_id,
            )
        )
        if existing.scalar_one_or_none():
            return
        st = SessionTag(session_id=session_id, tag_id=tag_id, created_at=created_at)
        self._session.add(st)
        await self._session.flush()

    async def remove_session_tag(self, session_id: str, tag_id: str) -> bool:
        """세션-태그 연결 제거. 삭제 성공 여부 반환."""
        stmt = delete(SessionTag).where(
            SessionTag.session_id == session_id,
            SessionTag.tag_id == tag_id,
        )
        result = await self._session.execute(stmt)
        return result.rowcount > 0

    async def get_session_tags(self, session_id: str) -> list[dict]:
        """세션에 연결된 태그 목록 조회."""
        stmt = (
            select(Tag.id, Tag.name, Tag.color)
            .join(SessionTag, SessionTag.tag_id == Tag.id)
            .where(SessionTag.session_id == session_id)
            .order_by(Tag.name.asc())
        )
        result = await self._session.execute(stmt)
        return [dict(row._mapping) for row in result.all()]

    async def get_tags_for_sessions(
        self, session_ids: list[str]
    ) -> dict[str, list[dict]]:
        """여러 세션의 태그 배치 조회. {session_id: [태그 목록]} 반환."""
        if not session_ids:
            return {}
        stmt = (
            select(SessionTag.session_id, Tag.id, Tag.name, Tag.color)
            .join(Tag, Tag.id == SessionTag.tag_id)
            .where(SessionTag.session_id.in_(session_ids))
            .order_by(Tag.name.asc())
        )
        result = await self._session.execute(stmt)
        tag_map: dict[str, list[dict]] = {sid: [] for sid in session_ids}
        for row in result.all():
            mapping = dict(row._mapping)
            sid = mapping.pop("session_id")
            tag_map[sid].append(mapping)
        return tag_map
