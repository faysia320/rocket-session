"""워크플로우 정의 관리 서비스."""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.database import Database
from app.models.workflow_definition import WorkflowDefinition
from app.models.workflow_node import WorkflowNode
from app.repositories.workflow_definition_repo import WorkflowDefinitionRepository
from app.repositories.workflow_node_repo import WorkflowNodeRepository
from app.schemas.workflow_definition import (
    ResolvedWorkflowStep,
    WorkflowDefinitionInfo,
    WorkflowStepConfig,
)
from app.schemas.workflow_node import WorkflowNodeInfo

logger = logging.getLogger(__name__)


class WorkflowDefinitionService:
    """워크플로우 정의 CRUD 및 export/import."""

    def __init__(self, db: Database) -> None:
        self._db = db

    @staticmethod
    def _entity_to_info(
        entity: WorkflowDefinition,
        node_map: dict[str, WorkflowNode],
    ) -> WorkflowDefinitionInfo:
        """ORM → Pydantic 변환. node_map으로 Node 정보를 결합."""
        steps_raw = [
            WorkflowStepConfig(**s) if isinstance(s, dict) else s
            for s in (entity.steps or [])
        ]
        resolved = []
        for sc in sorted(steps_raw, key=lambda x: x.order_index):
            node = node_map.get(sc.node_id)
            if not node:
                continue
            resolved.append(
                ResolvedWorkflowStep(
                    node_id=sc.node_id,
                    name=node.name,
                    label=node.label,
                    icon=node.icon,
                    prompt_template=node.prompt_template,
                    constraints=node.constraints,
                    order_index=sc.order_index,
                    auto_advance=sc.auto_advance,
                    review_required=sc.review_required,
                )
            )
        return WorkflowDefinitionInfo(
            id=entity.id,
            name=entity.name,
            description=entity.description,
            is_builtin=bool(entity.is_builtin),
            steps=resolved,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )

    @staticmethod
    def _collect_node_ids(entities: list[WorkflowDefinition]) -> set[str]:
        """엔티티 목록에서 모든 node_id를 수집."""
        ids: set[str] = set()
        for e in entities:
            for s in e.steps or []:
                nid = s.get("node_id") if isinstance(s, dict) else getattr(s, "node_id", None)
                if nid:
                    ids.add(nid)
        return ids

    async def _build_node_map(
        self, session, node_ids: set[str]
    ) -> dict[str, WorkflowNode]:
        """node_ids로 벌크 조회 후 dict 반환."""
        if not node_ids:
            return {}
        node_repo = WorkflowNodeRepository(session)
        nodes = await node_repo.get_by_ids(list(node_ids))
        return {n.id: n for n in nodes}

    # ── CRUD ─────────────────────────────────────────────────

    async def list_definitions(self) -> list[WorkflowDefinitionInfo]:
        async with self._db.session() as session:
            repo = WorkflowDefinitionRepository(session)
            entities = await repo.list_all()
            node_ids = self._collect_node_ids(entities)
            node_map = await self._build_node_map(session, node_ids)
            return [self._entity_to_info(e, node_map) for e in entities]

    async def get_definition(self, def_id: str) -> WorkflowDefinitionInfo | None:
        async with self._db.session() as session:
            repo = WorkflowDefinitionRepository(session)
            entity = await repo.get_by_id(def_id)
            if not entity:
                return None
            node_ids = self._collect_node_ids([entity])
            node_map = await self._build_node_map(session, node_ids)
            return self._entity_to_info(entity, node_map)

    async def create_definition(
        self,
        name: str,
        steps: list[WorkflowStepConfig],
        description: str | None = None,
    ) -> WorkflowDefinitionInfo:
        def_id = str(uuid.uuid4())[:16]
        now = datetime.now(timezone.utc)
        async with self._db.session() as session:
            repo = WorkflowDefinitionRepository(session)
            entity = WorkflowDefinition(
                id=def_id,
                name=name,
                description=description,
                is_builtin=False,
                steps=[s.model_dump() for s in steps],
                created_at=now,
                updated_at=now,
            )
            await repo.add(entity)
            await session.commit()
            node_ids = {s.node_id for s in steps}
            node_map = await self._build_node_map(session, node_ids)
            return self._entity_to_info(entity, node_map)

    async def update_definition(
        self,
        def_id: str,
        name: str | None = None,
        description: str | None = None,
        steps: list[WorkflowStepConfig] | None = None,
    ) -> WorkflowDefinitionInfo | None:
        now = datetime.now(timezone.utc)
        kwargs: dict = {"updated_at": now}
        if name is not None:
            kwargs["name"] = name
        if description is not None:
            kwargs["description"] = description
        if steps is not None:
            kwargs["steps"] = [s.model_dump() for s in steps]
        async with self._db.session() as session:
            repo = WorkflowDefinitionRepository(session)
            entity = await repo.update_definition(def_id, **kwargs)
            if not entity:
                return None
            await session.commit()
            node_ids = self._collect_node_ids([entity])
            node_map = await self._build_node_map(session, node_ids)
            return self._entity_to_info(entity, node_map)

    async def delete_definition(self, def_id: str) -> bool:
        async with self._db.session() as session:
            repo = WorkflowDefinitionRepository(session)
            entity = await repo.get_by_id(def_id)
            if not entity:
                return False
            if entity.is_builtin:
                from fastapi import HTTPException

                raise HTTPException(
                    status_code=400,
                    detail="기본 내장 워크플로우는 삭제할 수 없습니다",
                )
            deleted = await repo.delete_by_id(def_id)
            await session.commit()
            return deleted

    async def get_or_default(
        self, def_id: str | None
    ) -> WorkflowDefinitionInfo:
        """def_id로 조회하되, None이거나 못 찾으면 builtin default 반환."""
        if def_id:
            info = await self.get_definition(def_id)
            if info:
                return info
        # builtin default 조회
        async with self._db.session() as session:
            repo = WorkflowDefinitionRepository(session)
            entity = await repo.get_builtin_default()
            if entity:
                node_ids = self._collect_node_ids([entity])
                node_map = await self._build_node_map(session, node_ids)
                return self._entity_to_info(entity, node_map)
        # builtin도 없으면 하드코딩 fallback
        return WorkflowDefinitionInfo(
            id="fallback",
            name="Default",
            steps=[
                ResolvedWorkflowStep(
                    node_id="fallback-research",
                    name="research",
                    label="Research",
                    icon="Search",
                    prompt_template="",
                    constraints="readonly",
                    auto_advance=True,
                    review_required=False,
                    order_index=0,
                ),
                ResolvedWorkflowStep(
                    node_id="fallback-plan",
                    name="plan",
                    label="Plan",
                    icon="FileText",
                    prompt_template="",
                    constraints="readonly",
                    auto_advance=False,
                    review_required=True,
                    order_index=1,
                ),
                ResolvedWorkflowStep(
                    node_id="fallback-implement",
                    name="implement",
                    label="Implement",
                    icon="Code",
                    prompt_template="",
                    constraints="full",
                    auto_advance=False,
                    review_required=False,
                    order_index=2,
                ),
            ],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

    # ── Export / Import ──────────────────────────────────────

    async def export_definition(self, def_id: str) -> dict | None:
        info = await self.get_definition(def_id)
        if not info:
            return None
        # 참조된 노드 데이터도 포함
        node_ids = {s.node_id for s in info.steps}
        nodes_info: list[dict] = []
        if node_ids:
            async with self._db.session() as session:
                node_repo = WorkflowNodeRepository(session)
                nodes = await node_repo.get_by_ids(list(node_ids))
                from app.services.workflow_node_service import WorkflowNodeService

                nodes_info = [
                    WorkflowNodeService._entity_to_info(n).model_dump()
                    for n in nodes
                ]
        return {
            "version": 1,
            "definition": info.model_dump(),
            "nodes": nodes_info,
        }

    async def import_definition(
        self,
        data: WorkflowDefinitionInfo,
        nodes_data: list[WorkflowNodeInfo] | None = None,
    ) -> WorkflowDefinitionInfo:
        """export 데이터에서 새 정의를 import. 노드 먼저 생성/매칭 후 정의 생성."""
        # 노드 매칭/생성
        node_id_remap: dict[str, str] = {}
        if nodes_data:
            async with self._db.session() as session:
                node_repo = WorkflowNodeRepository(session)
                for nd in nodes_data:
                    existing = await node_repo.get_by_name(nd.name)
                    if existing:
                        node_id_remap[nd.id] = existing.id
                    else:
                        now = datetime.now(timezone.utc)
                        new_node = WorkflowNode(
                            id=str(uuid.uuid4())[:16],
                            name=nd.name,
                            label=nd.label,
                            icon=nd.icon,
                            prompt_template=nd.prompt_template,
                            constraints=nd.constraints,
                            is_builtin=False,
                            created_at=now,
                            updated_at=now,
                        )
                        await node_repo.add(new_node)
                        node_id_remap[nd.id] = new_node.id
                await session.commit()

        # 이름 중복 처리
        base_name = data.name
        name = base_name
        counter = 2
        async with self._db.session() as session:
            result = await session.execute(
                select(WorkflowDefinition.name).where(
                    WorkflowDefinition.name.like(f"{base_name}%")
                )
            )
            existing_names = {row[0] for row in result}
            while name in existing_names:
                name = f"{base_name} ({counter})"
                counter += 1

        # steps의 node_id를 remap
        remapped_steps = []
        for step in data.steps:
            new_node_id = node_id_remap.get(step.node_id, step.node_id)
            remapped_steps.append(
                WorkflowStepConfig(
                    node_id=new_node_id,
                    order_index=step.order_index,
                    auto_advance=step.auto_advance,
                    review_required=step.review_required,
                )
            )

        return await self.create_definition(
            name=name,
            steps=remapped_steps,
            description=data.description,
        )
