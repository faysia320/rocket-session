"""워크플로우 노드 Repository."""

from sqlalchemy import select

from app.models.workflow_node import WorkflowNode
from app.repositories.base import BaseRepository


class WorkflowNodeRepository(BaseRepository[WorkflowNode]):
    """workflow_nodes 테이블 CRUD."""

    model_class = WorkflowNode

    async def get_by_name(self, name: str) -> WorkflowNode | None:
        """이름으로 조회."""
        result = await self._session.execute(
            select(WorkflowNode).where(WorkflowNode.name == name)
        )
        return result.scalar_one_or_none()

    async def list_all(self) -> list[WorkflowNode]:
        """전체 목록 (이름순)."""
        result = await self._session.execute(
            select(WorkflowNode).order_by(WorkflowNode.name.asc())
        )
        return list(result.scalars().all())

    async def get_by_ids(self, ids: list[str]) -> list[WorkflowNode]:
        """ID 목록으로 벌크 조회."""
        if not ids:
            return []
        result = await self._session.execute(
            select(WorkflowNode).where(WorkflowNode.id.in_(ids))
        )
        return list(result.scalars().all())

    async def update_node(self, node_id: str, **kwargs) -> WorkflowNode | None:
        """노드 속성 업데이트. kwargs에 있는 필드만 변경."""
        node = await self.get_by_id(node_id)
        if not node:
            return None
        for key, value in kwargs.items():
            setattr(node, key, value)
        await self._session.flush()
        return node
