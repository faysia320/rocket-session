"""워크플로우 정의 관리 서비스."""

import logging
import uuid

from sqlalchemy import select

from app.core.exceptions import NotFoundError, ValidationError
from app.core.utils import utc_now
from app.models.workflow_definition import WorkflowDefinition
from app.repositories.workflow_definition_repo import WorkflowDefinitionRepository
from app.schemas.workflow_definition import WorkflowDefinitionInfo, WorkflowStepConfig
from app.services.base import DBService

logger = logging.getLogger(__name__)


class WorkflowDefinitionService(DBService):
    """워크플로우 정의 CRUD 및 export/import."""

    # ── CRUD ─────────────────────────────────────────────────

    async def list_definitions(self) -> list[WorkflowDefinitionInfo]:
        async with self._session_scope(WorkflowDefinitionRepository) as (session, repo):
            entities = await repo.list_all()
            return [WorkflowDefinitionInfo.model_validate(e) for e in entities]

    async def get_definition(self, def_id: str) -> WorkflowDefinitionInfo:
        async with self._session_scope(WorkflowDefinitionRepository) as (session, repo):
            entity = await repo.get_by_id(def_id)
            if not entity:
                raise NotFoundError(f"워크플로우 정의를 찾을 수 없습니다: {def_id}")
            return WorkflowDefinitionInfo.model_validate(entity)

    async def create_definition(
        self,
        name: str,
        steps: list[WorkflowStepConfig],
        description: str | None = None,
    ) -> WorkflowDefinitionInfo:
        def_id = str(uuid.uuid4())[:16]
        now = utc_now()
        async with self._session_scope(WorkflowDefinitionRepository) as (session, repo):
            entity = WorkflowDefinition(
                id=def_id,
                name=name,
                description=description,
                is_builtin=False,
                is_default=False,
                steps=[s.model_dump() for s in steps],
                created_at=now,
                updated_at=now,
            )
            await repo.add(entity)
            await session.commit()
            return WorkflowDefinitionInfo.model_validate(entity)

    async def update_definition(
        self,
        def_id: str,
        name: str | None = None,
        description: str | None = None,
        steps: list[WorkflowStepConfig] | None = None,
    ) -> WorkflowDefinitionInfo:
        now = utc_now()
        kwargs: dict = {"updated_at": now}
        if name is not None:
            kwargs["name"] = name
        if description is not None:
            kwargs["description"] = description
        if steps is not None:
            kwargs["steps"] = [s.model_dump() for s in steps]
        async with self._session_scope(WorkflowDefinitionRepository) as (session, repo):
            existing = await repo.get_by_id(def_id)
            if not existing:
                raise NotFoundError(f"워크플로우 정의를 찾을 수 없습니다: {def_id}")
            if existing.is_builtin and name is not None and name != existing.name:
                raise ValidationError("시스템 워크플로우의 이름은 변경할 수 없습니다")
            entity = await repo.update_definition(def_id, **kwargs)
            if not entity:
                raise NotFoundError(f"워크플로우 정의를 찾을 수 없습니다: {def_id}")
            await session.commit()
            return WorkflowDefinitionInfo.model_validate(entity)

    async def delete_definition(self, def_id: str) -> bool:
        async with self._session_scope(WorkflowDefinitionRepository) as (session, repo):
            entity = await repo.get_by_id(def_id)
            if not entity:
                raise NotFoundError(f"워크플로우 정의를 찾을 수 없습니다: {def_id}")
            if entity.is_builtin:
                raise ValidationError("시스템 워크플로우는 삭제할 수 없습니다")
            was_default = entity.is_default
            deleted = await repo.delete_by_id(def_id)
            if was_default:
                remaining = await repo.list_all()
                if remaining:
                    remaining[0].is_default = True
                    await session.flush()
            await session.commit()
            return deleted

    async def set_default(self, def_id: str) -> WorkflowDefinitionInfo:
        """지정된 워크플로우를 기본(default)으로 설정. 기존 default는 해제."""
        async with self._session_scope(WorkflowDefinitionRepository) as (session, repo):
            entity = await repo.get_by_id(def_id)
            if not entity:
                raise NotFoundError(f"워크플로우 정의를 찾을 수 없습니다: {def_id}")
            await repo.clear_all_defaults()
            entity.is_default = True
            await session.flush()
            await session.commit()
            return WorkflowDefinitionInfo.model_validate(entity)

    async def get_or_default(self, def_id: str | None) -> WorkflowDefinitionInfo:
        """def_id로 조회하되, None이거나 못 찾으면 default 반환."""
        if def_id:
            try:
                return await self.get_definition(def_id)
            except NotFoundError:
                pass
        # default 워크플로우 조회
        async with self._session_scope(WorkflowDefinitionRepository) as (session, repo):
            entity = await repo.get_default()
            if entity:
                return WorkflowDefinitionInfo.model_validate(entity)
        # default도 없으면 하드코딩 fallback을 DB에 저장 후 반환
        now = utc_now()
        fallback_id = f"default-{uuid.uuid4().hex[:8]}"
        fallback_steps = [
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
                run_validation=False,
                order_index=2,
            ),
            WorkflowStepConfig(
                name="qa",
                label="QA",
                icon="ShieldCheck",
                prompt_template="",
                constraints="readonly",
                review_required=True,
                run_validation=True,
                order_index=3,
            ),
        ]
        async with self._session_scope(WorkflowDefinitionRepository) as (session, repo):
            entity = WorkflowDefinition(
                id=fallback_id,
                name="Default",
                is_builtin=True,
                is_default=True,
                sort_order=0,
                steps=[s.model_dump() for s in fallback_steps],
                created_at=now,
                updated_at=now,
            )
            await repo.add(entity)
            await session.commit()
            logger.info("기본 워크플로우 정의 자동 생성: %s", fallback_id)
        return WorkflowDefinitionInfo(
            id=fallback_id,
            name="Default",
            is_default=True,
            steps=fallback_steps,
            created_at=now,
            updated_at=now,
        )

    # ── Export / Import ──────────────────────────────────────

    async def export_definition(self, def_id: str) -> dict:
        info = await self.get_definition(def_id)
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
