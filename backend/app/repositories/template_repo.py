"""세션 템플릿 Repository."""

from sqlalchemy import select

from app.models.template import SessionTemplate
from app.repositories.base import BaseRepository


class TemplateRepository(BaseRepository[SessionTemplate]):
    """session_templates 테이블 CRUD."""

    model_class = SessionTemplate

    async def get_by_name(self, name: str) -> SessionTemplate | None:
        """템플릿 이름으로 조회."""
        result = await self._session.execute(
            select(SessionTemplate).where(SessionTemplate.name == name)
        )
        return result.scalar_one_or_none()

    async def list_all(self) -> list[SessionTemplate]:
        """전체 템플릿 목록 (최근 수정순)."""
        result = await self._session.execute(
            select(SessionTemplate).order_by(SessionTemplate.updated_at.desc())
        )
        return list(result.scalars().all())

    async def update_template(
        self, template_id: str, **kwargs
    ) -> SessionTemplate | None:
        """템플릿 속성 업데이트. kwargs에 있는 필드만 변경."""
        template = await self.get_by_id(template_id)
        if not template:
            return None
        for key, value in kwargs.items():
            setattr(template, key, value)
        await self._session.flush()
        return template
