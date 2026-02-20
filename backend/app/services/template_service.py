"""세션 템플릿 관리 서비스."""

import json
import logging
import uuid
from datetime import datetime, timezone

from app.core.database import Database
from app.schemas.template import TemplateInfo

logger = logging.getLogger(__name__)


class TemplateService:
    """세션 템플릿 CRUD 및 export/import."""

    def __init__(self, db: Database) -> None:
        self._db = db

    @staticmethod
    def _parse_json(val: str | None, default=None):
        if not val:
            return default
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return default

    @classmethod
    def _row_to_info(cls, row: dict) -> TemplateInfo:
        """DB row → TemplateInfo 변환."""
        return TemplateInfo(
            id=row["id"],
            name=row["name"],
            description=row.get("description"),
            work_dir=row.get("work_dir"),
            system_prompt=row.get("system_prompt"),
            allowed_tools=row.get("allowed_tools"),
            disallowed_tools=row.get("disallowed_tools"),
            timeout_seconds=row.get("timeout_seconds"),
            mode=row.get("mode") or "normal",
            permission_mode=bool(row.get("permission_mode", 0)),
            permission_required_tools=cls._parse_json(
                row.get("permission_required_tools")
            ),
            model=row.get("model"),
            max_turns=row.get("max_turns"),
            max_budget_usd=row.get("max_budget_usd"),
            system_prompt_mode=row.get("system_prompt_mode") or "replace",
            mcp_server_ids=cls._parse_json(row.get("mcp_server_ids")),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    # ── CRUD ─────────────────────────────────────────────────

    async def list_templates(self) -> list[TemplateInfo]:
        rows = await self._db.list_templates()
        return [self._row_to_info(r) for r in rows]

    async def get_template(self, template_id: str) -> TemplateInfo | None:
        row = await self._db.get_template(template_id)
        return self._row_to_info(row) if row else None

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
        row = await self._db.create_template(
            template_id=template_id,
            name=name,
            created_at=now,
            description=description,
            work_dir=work_dir,
            system_prompt=system_prompt,
            allowed_tools=allowed_tools,
            disallowed_tools=disallowed_tools,
            timeout_seconds=timeout_seconds,
            mode=mode or "normal",
            permission_mode=permission_mode or False,
            permission_required_tools=(
                json.dumps(permission_required_tools)
                if permission_required_tools
                else None
            ),
            model=model,
            max_turns=max_turns,
            max_budget_usd=max_budget_usd,
            system_prompt_mode=system_prompt_mode or "replace",
            mcp_server_ids=(
                json.dumps(mcp_server_ids) if mcp_server_ids else None
            ),
        )
        return self._row_to_info(row)

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
        kwargs: dict = {}
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
            kwargs["permission_required_tools"] = json.dumps(
                permission_required_tools
            )
        if model is not None:
            kwargs["model"] = model
        if max_turns is not None:
            kwargs["max_turns"] = max_turns
        if max_budget_usd is not None:
            kwargs["max_budget_usd"] = max_budget_usd
        if system_prompt_mode is not None:
            kwargs["system_prompt_mode"] = system_prompt_mode
        if mcp_server_ids is not None:
            kwargs["mcp_server_ids"] = json.dumps(mcp_server_ids)
        row = await self._db.update_template(template_id, updated_at=now, **kwargs)
        return self._row_to_info(row) if row else None

    async def delete_template(self, template_id: str) -> bool:
        return await self._db.delete_template(template_id)

    # ── 세션에서 템플릿 생성 ─────────────────────────────────

    async def create_from_session(
        self,
        session_id: str,
        name: str,
        description: str | None = None,
    ) -> TemplateInfo | None:
        """기존 세션의 설정을 복사하여 새 템플릿 생성."""
        session = await self._db.get_session(session_id)
        if not session:
            return None

        return await self.create_template(
            name=name,
            description=description,
            work_dir=session.get("work_dir"),
            system_prompt=session.get("system_prompt"),
            allowed_tools=session.get("allowed_tools"),
            disallowed_tools=session.get("disallowed_tools"),
            timeout_seconds=session.get("timeout_seconds"),
            mode=session.get("mode"),
            permission_mode=bool(session.get("permission_mode", 0)),
            permission_required_tools=self._parse_json(
                session.get("permission_required_tools")
            ),
            model=session.get("model"),
            max_turns=session.get("max_turns"),
            max_budget_usd=session.get("max_budget_usd"),
            system_prompt_mode=session.get("system_prompt_mode"),
            mcp_server_ids=self._parse_json(session.get("mcp_server_ids")),
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
        while await self._db.get_template_by_name(name):
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
