"""워크플로우 정의 Repository."""

from sqlalchemy import select, update

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
        """전체 목록 (시스템 워크플로우 상단 고정, 이후 기본 우선·최근 수정순)."""
        result = await self._session.execute(
            select(WorkflowDefinition).order_by(
                WorkflowDefinition.is_builtin.desc(),
                WorkflowDefinition.sort_order.asc(),
                WorkflowDefinition.is_default.desc(),
                WorkflowDefinition.updated_at.desc(),
            )
        )
        return list(result.scalars().all())

    async def get_default(self) -> WorkflowDefinition | None:
        """기본(default) 워크플로우 조회."""
        result = await self._session.execute(
            select(WorkflowDefinition).where(WorkflowDefinition.is_default == True)  # noqa: E712
        )
        return result.scalars().first()

    async def clear_all_defaults(self) -> None:
        """모든 워크플로우의 is_default 플래그를 해제."""
        await self._session.execute(
            update(WorkflowDefinition)
            .where(WorkflowDefinition.is_default == True)  # noqa: E712
            .values(is_default=False)
        )
        await self._session.flush()

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
