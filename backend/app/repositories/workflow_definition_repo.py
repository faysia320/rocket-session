"""워크플로우 정의 Repository."""

from sqlalchemy import select

from app.models.workflow_definition import WorkflowDefinition
from app.repositories.base import BaseRepository


class WorkflowDefinitionRepository(BaseRepository[WorkflowDefinition]):
    """workflow_definitions 테이블 CRUD."""

    model_class = WorkflowDefinition

    async def get_by_name(self, name: str) -> WorkflowDefinition | None:
        """이름으로 조회."""
        result = await self._session.execute(
            select(WorkflowDefinition).where(WorkflowDefinition.name == name)
        )
        return result.scalar_one_or_none()

    async def list_all(self) -> list[WorkflowDefinition]:
        """전체 목록 (최근 수정순)."""
        result = await self._session.execute(
            select(WorkflowDefinition).order_by(WorkflowDefinition.updated_at.desc())
        )
        return list(result.scalars().all())

    async def get_builtin_default(self) -> WorkflowDefinition | None:
        """기본 내장 프리셋 조회."""
        result = await self._session.execute(
            select(WorkflowDefinition).where(WorkflowDefinition.is_builtin == True)  # noqa: E712
        )
        return result.scalars().first()

    async def update_definition(
        self, def_id: str, **kwargs
    ) -> WorkflowDefinition | None:
        """정의 속성 업데이트. kwargs에 있는 필드만 변경."""
        definition = await self.get_by_id(def_id)
        if not definition:
            return None
        for key, value in kwargs.items():
            setattr(definition, key, value)
        await self._session.flush()
        return definition
