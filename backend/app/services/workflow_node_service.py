"""워크플로우 노드 관리 서비스."""

import logging
import uuid
from datetime import datetime, timezone

from app.core.database import Database
from app.models.workflow_node import WorkflowNode
from app.repositories.workflow_node_repo import WorkflowNodeRepository
from app.schemas.workflow_node import WorkflowNodeInfo

logger = logging.getLogger(__name__)


class WorkflowNodeService:
    """워크플로우 노드 CRUD."""

    def __init__(self, db: Database) -> None:
        self._db = db

    @staticmethod
    def _entity_to_info(node: WorkflowNode) -> WorkflowNodeInfo:
        return WorkflowNodeInfo(
            id=node.id,
            name=node.name,
            label=node.label,
            icon=node.icon,
            prompt_template=node.prompt_template,
            constraints=node.constraints,
            is_builtin=bool(node.is_builtin),
            created_at=node.created_at,
            updated_at=node.updated_at,
        )

    async def list_nodes(self) -> list[WorkflowNodeInfo]:
        async with self._db.session() as session:
            repo = WorkflowNodeRepository(session)
            nodes = await repo.list_all()
            return [self._entity_to_info(n) for n in nodes]

    async def get_node(self, node_id: str) -> WorkflowNodeInfo | None:
        async with self._db.session() as session:
            repo = WorkflowNodeRepository(session)
            node = await repo.get_by_id(node_id)
            return self._entity_to_info(node) if node else None

    async def create_node(
        self,
        name: str,
        label: str,
        icon: str = "FileText",
        prompt_template: str = "",
        constraints: str = "readonly",
    ) -> WorkflowNodeInfo:
        node_id = str(uuid.uuid4())[:16]
        now = datetime.now(timezone.utc)
        async with self._db.session() as session:
            repo = WorkflowNodeRepository(session)
            node = WorkflowNode(
                id=node_id,
                name=name,
                label=label,
                icon=icon,
                prompt_template=prompt_template,
                constraints=constraints,
                is_builtin=False,
                created_at=now,
                updated_at=now,
            )
            await repo.add(node)
            await session.commit()
            return self._entity_to_info(node)

    async def update_node(
        self,
        node_id: str,
        **kwargs,
    ) -> WorkflowNodeInfo | None:
        kwargs["updated_at"] = datetime.now(timezone.utc)
        async with self._db.session() as session:
            repo = WorkflowNodeRepository(session)
            node = await repo.update_node(node_id, **kwargs)
            if not node:
                return None
            await session.commit()
            return self._entity_to_info(node)

    async def delete_node(self, node_id: str) -> bool:
        from fastapi import HTTPException
        from sqlalchemy import text

        async with self._db.session() as session:
            repo = WorkflowNodeRepository(session)
            node = await repo.get_by_id(node_id)
            if not node:
                return False
            if node.is_builtin:
                raise HTTPException(
                    status_code=400,
                    detail="기본 내장 노드는 삭제할 수 없습니다",
                )
            # 참조 체크: workflow_definitions의 steps에서 node_id 사용 여부
            result = await session.execute(
                text(
                    "SELECT id FROM workflow_definitions "
                    "WHERE steps::jsonb @> :pattern LIMIT 1"
                ),
                {"pattern": f'[{{"node_id": "{node_id}"}}]'},
            )
            if result.first():
                raise HTTPException(
                    status_code=400,
                    detail="이 노드를 사용하는 워크플로우 정의가 있어 삭제할 수 없습니다",
                )
            deleted = await repo.delete_by_id(node_id)
            await session.commit()
            return deleted
