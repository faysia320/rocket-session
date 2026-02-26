"""워크플로우 정의 관리 서비스."""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.database import Database
from app.models.workflow_definition import WorkflowDefinition
from app.repositories.workflow_definition_repo import WorkflowDefinitionRepository
from app.schemas.workflow_definition import (
    WorkflowDefinitionInfo,
    WorkflowStepConfig,
)

logger = logging.getLogger(__name__)


class WorkflowDefinitionService:
    """워크플로우 정의 CRUD 및 export/import."""

    def __init__(self, db: Database) -> None:
        self._db = db

    @staticmethod
    def _entity_to_info(entity: WorkflowDefinition) -> WorkflowDefinitionInfo:
        """ORM → Pydantic 변환. steps JSONB를 직접 반환."""
        steps_raw = [
            WorkflowStepConfig(**s) if isinstance(s, dict) else s
            for s in (entity.steps or [])
        ]
        resolved = sorted(steps_raw, key=lambda x: x.order_index)
        return WorkflowDefinitionInfo(
            id=entity.id,
            name=entity.name,
            description=entity.description,
            is_builtin=bool(entity.is_builtin),
            steps=resolved,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )

    # ── CRUD ─────────────────────────────────────────────────

    async def list_definitions(self) -> list[WorkflowDefinitionInfo]:
        async with self._db.session() as session:
            repo = WorkflowDefinitionRepository(session)
            entities = await repo.list_all()
            return [self._entity_to_info(e) for e in entities]

    async def get_definition(self, def_id: str) -> WorkflowDefinitionInfo | None:
        async with self._db.session() as session:
            repo = WorkflowDefinitionRepository(session)
            entity = await repo.get_by_id(def_id)
            if not entity:
                return None
            return self._entity_to_info(entity)

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
            return self._entity_to_info(entity)

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
            return self._entity_to_info(entity)

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

    async def get_or_default(self, def_id: str | None) -> WorkflowDefinitionInfo:
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
                return self._entity_to_info(entity)
        # builtin도 없으면 하드코딩 fallback
        return WorkflowDefinitionInfo(
            id="fallback",
            name="Default",
            steps=[
                WorkflowStepConfig(
                    name="research",
                    label="Research",
                    icon="Search",
                    prompt_template="",
                    constraints="readonly",
                    review_required=False,
                    order_index=0,
                ),
                WorkflowStepConfig(
                    name="plan",
                    label="Plan",
                    icon="FileText",
                    prompt_template="",
                    constraints="readonly",
                    review_required=True,
                    order_index=1,
                ),
                WorkflowStepConfig(
                    name="implement",
                    label="Implement",
                    icon="Code",
                    prompt_template="",
                    constraints="full",
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
        return {
            "version": 1,
            "definition": info.model_dump(),
        }

    async def import_definition(
        self,
        data: WorkflowDefinitionInfo,
    ) -> WorkflowDefinitionInfo:
        """export 데이터에서 새 정의를 import."""
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

        return await self.create_definition(
            name=name,
            steps=data.steps,
            description=data.description,
        )
