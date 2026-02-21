"""세션 템플릿 관리 서비스."""

import logging
import uuid
from datetime import datetime, timezone

from app.core.database import Database
from app.models.template import SessionTemplate
from app.repositories.session_repo import SessionRepository
from app.repositories.template_repo import TemplateRepository
from app.schemas.template import TemplateInfo

logger = logging.getLogger(__name__)


class TemplateService:
    """세션 템플릿 CRUD 및 export/import."""

    def __init__(self, db: Database) -> None:
        self._db = db

    @staticmethod
    def _entity_to_info(tmpl: SessionTemplate) -> TemplateInfo:
        """SessionTemplate ORM 엔티티 → TemplateInfo 변환. JSONB는 이미 Python 객체."""
        return TemplateInfo(
            id=tmpl.id,
            name=tmpl.name,
            description=tmpl.description,
            work_dir=tmpl.work_dir,
            system_prompt=tmpl.system_prompt,
            allowed_tools=tmpl.allowed_tools,
            disallowed_tools=tmpl.disallowed_tools,
            timeout_seconds=tmpl.timeout_seconds,
            mode=tmpl.mode or "normal",
            permission_mode=tmpl.permission_mode,
            permission_required_tools=tmpl.permission_required_tools,
            model=tmpl.model,
            max_turns=tmpl.max_turns,
            max_budget_usd=tmpl.max_budget_usd,
            system_prompt_mode=tmpl.system_prompt_mode or "replace",
            mcp_server_ids=tmpl.mcp_server_ids,
            created_at=tmpl.created_at,
            updated_at=tmpl.updated_at,
        )

    # ── CRUD ─────────────────────────────────────────────────

    async def list_templates(self) -> list[TemplateInfo]:
        async with self._db.session() as session:
            repo = TemplateRepository(session)
            templates = await repo.list_all()
            return [self._entity_to_info(t) for t in templates]

    async def get_template(self, template_id: str) -> TemplateInfo | None:
        async with self._db.session() as session:
            repo = TemplateRepository(session)
            tmpl = await repo.get_by_id(template_id)
            return self._entity_to_info(tmpl) if tmpl else None

    async def create_template(
        self,
        name: str,
        description: str | None = None,
        work_dir: str | None = None,
        system_prompt: str | None = None,
        allowed_tools: str | None = None,
        disallowed_tools: str | None = None,
        timeout_seconds: int | None = None,
        mode: str | None = None,
        permission_mode: bool | None = None,
        permission_required_tools: list[str] | None = None,
        model: str | None = None,
        max_turns: int | None = None,
        max_budget_usd: float | None = None,
        system_prompt_mode: str | None = None,
        mcp_server_ids: list[str] | None = None,
    ) -> TemplateInfo:
        template_id = str(uuid.uuid4())[:16]
        now = datetime.now(timezone.utc).isoformat()
        async with self._db.session() as session:
            repo = TemplateRepository(session)
            tmpl = SessionTemplate(
                id=template_id,
                name=name,
                description=description,
                work_dir=work_dir,
                system_prompt=system_prompt,
                allowed_tools=allowed_tools,
                disallowed_tools=disallowed_tools,
                timeout_seconds=timeout_seconds,
                mode=mode or "normal",
                permission_mode=permission_mode or False,
                permission_required_tools=permission_required_tools,
                model=model,
                max_turns=max_turns,
                max_budget_usd=max_budget_usd,
                system_prompt_mode=system_prompt_mode or "replace",
                mcp_server_ids=mcp_server_ids,
                created_at=now,
                updated_at=now,
            )
            await repo.add(tmpl)
            await session.commit()
            return self._entity_to_info(tmpl)

    async def update_template(
        self,
        template_id: str,
        name: str | None = None,
        description: str | None = None,
        work_dir: str | None = None,
        system_prompt: str | None = None,
        allowed_tools: str | None = None,
        disallowed_tools: str | None = None,
        timeout_seconds: int | None = None,
        mode: str | None = None,
        permission_mode: bool | None = None,
        permission_required_tools: list[str] | None = None,
        model: str | None = None,
        max_turns: int | None = None,
        max_budget_usd: float | None = None,
        system_prompt_mode: str | None = None,
        mcp_server_ids: list[str] | None = None,
    ) -> TemplateInfo | None:
        now = datetime.now(timezone.utc).isoformat()
        kwargs: dict = {"updated_at": now}
        if name is not None:
            kwargs["name"] = name
        if description is not None:
            kwargs["description"] = description
        if work_dir is not None:
            kwargs["work_dir"] = work_dir
        if system_prompt is not None:
            kwargs["system_prompt"] = system_prompt
        if allowed_tools is not None:
            kwargs["allowed_tools"] = allowed_tools
        if disallowed_tools is not None:
            kwargs["disallowed_tools"] = disallowed_tools
        if timeout_seconds is not None:
            kwargs["timeout_seconds"] = timeout_seconds
        if mode is not None:
            kwargs["mode"] = mode
        if permission_mode is not None:
            kwargs["permission_mode"] = permission_mode
        if permission_required_tools is not None:
            kwargs["permission_required_tools"] = permission_required_tools
        if model is not None:
            kwargs["model"] = model
        if max_turns is not None:
            kwargs["max_turns"] = max_turns
        if max_budget_usd is not None:
            kwargs["max_budget_usd"] = max_budget_usd
        if system_prompt_mode is not None:
            kwargs["system_prompt_mode"] = system_prompt_mode
        if mcp_server_ids is not None:
            kwargs["mcp_server_ids"] = mcp_server_ids
        async with self._db.session() as session:
            repo = TemplateRepository(session)
            tmpl = await repo.update_template(template_id, **kwargs)
            await session.commit()
            return self._entity_to_info(tmpl) if tmpl else None

    async def delete_template(self, template_id: str) -> bool:
        async with self._db.session() as session:
            repo = TemplateRepository(session)
            deleted = await repo.delete_by_id(template_id)
            await session.commit()
            return deleted

    # ── 세션에서 템플릿 생성 ─────────────────────────────────

    async def create_from_session(
        self,
        session_id: str,
        name: str,
        description: str | None = None,
    ) -> TemplateInfo | None:
        """기존 세션의 설정을 복사하여 새 템플릿 생성."""
        async with self._db.session() as db_session:
            repo = SessionRepository(db_session)
            entity = await repo.get_by_id(session_id)
            if not entity:
                return None

        return await self.create_template(
            name=name,
            description=description,
            work_dir=entity.work_dir,
            system_prompt=entity.system_prompt,
            allowed_tools=entity.allowed_tools,
            disallowed_tools=entity.disallowed_tools,
            timeout_seconds=entity.timeout_seconds,
            mode=entity.mode,
            permission_mode=entity.permission_mode,
            permission_required_tools=entity.permission_required_tools,
            model=entity.model,
            max_turns=entity.max_turns,
            max_budget_usd=entity.max_budget_usd,
            system_prompt_mode=entity.system_prompt_mode,
            mcp_server_ids=entity.mcp_server_ids,
        )

    # ── Export / Import ──────────────────────────────────────

    async def export_template(self, template_id: str) -> dict | None:
        """템플릿을 export 가능한 dict로 반환."""
        info = await self.get_template(template_id)
        if not info:
            return None
        return {"version": 1, "template": info.model_dump()}

    async def import_template(self, data: TemplateInfo) -> TemplateInfo:
        """export 데이터에서 새 템플릿을 import."""
        # 이름 중복 처리: 자동 suffix 추가
        base_name = data.name
        name = base_name
        counter = 2
        async with self._db.session() as session:
            repo = TemplateRepository(session)
            while await repo.get_by_name(name):
                name = f"{base_name} ({counter})"
                counter += 1

        return await self.create_template(
            name=name,
            description=data.description,
            work_dir=data.work_dir,
            system_prompt=data.system_prompt,
            allowed_tools=data.allowed_tools,
            disallowed_tools=data.disallowed_tools,
            timeout_seconds=data.timeout_seconds,
            mode=data.mode,
            permission_mode=data.permission_mode,
            permission_required_tools=data.permission_required_tools,
            model=data.model,
            max_turns=data.max_turns,
            max_budget_usd=data.max_budget_usd,
            system_prompt_mode=data.system_prompt_mode,
            mcp_server_ids=data.mcp_server_ids,
        )
