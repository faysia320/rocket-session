"""글로벌 설정 관리 서비스."""

import logging

from app.core.database import Database
from app.repositories.settings_repo import SettingsRepository

logger = logging.getLogger(__name__)


class SettingsService:
    """글로벌 기본 설정 조회/수정 서비스."""

    def __init__(self, db: Database) -> None:
        self._db = db

    async def get(self) -> dict:
        """글로벌 설정을 딕셔너리로 반환. JSONB 필드는 이미 Python 객체."""
        async with self._db.session() as session:
            repo = SettingsRepository(session)
            entity = await repo.get_default()
            if not entity:
                return {}
            return {
                "id": entity.id,
                "work_dir": entity.work_dir,
                "allowed_tools": entity.allowed_tools,
                "system_prompt": entity.system_prompt,
                "timeout_seconds": entity.timeout_seconds,
                "mode": entity.mode,
                "permission_mode": entity.permission_mode,
                "permission_required_tools": entity.permission_required_tools,
                "model": entity.model,
                "max_turns": entity.max_turns,
                "max_budget_usd": entity.max_budget_usd,
                "system_prompt_mode": entity.system_prompt_mode,
                "disallowed_tools": entity.disallowed_tools,
                "mcp_server_ids": entity.mcp_server_ids,
                "globally_trusted_tools": entity.globally_trusted_tools,
                "additional_dirs": entity.additional_dirs,
                "fallback_model": entity.fallback_model,
            }

    async def update(
        self,
        work_dir: str | None = None,
        allowed_tools: str | None = None,
        system_prompt: str | None = None,
        timeout_seconds: int | None = None,
        mode: str | None = None,
        permission_mode: bool | None = None,
        permission_required_tools: list[str] | None = None,
        model: str | None = None,
        max_turns: int | None = None,
        max_budget_usd: float | None = None,
        system_prompt_mode: str | None = None,
        disallowed_tools: str | None = None,
        mcp_server_ids: list[str] | None = None,
        globally_trusted_tools: list[str] | None = None,
        additional_dirs: list[str] | None = None,
        fallback_model: str | None = None,
    ) -> dict:
        """글로벌 설정 업데이트 후 최신 상태 반환. JSONB 필드는 직접 저장."""
        kwargs: dict = {}
        if work_dir is not None:
            kwargs["work_dir"] = work_dir
        if allowed_tools is not None:
            kwargs["allowed_tools"] = allowed_tools
        if system_prompt is not None:
            kwargs["system_prompt"] = system_prompt
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
        if disallowed_tools is not None:
            kwargs["disallowed_tools"] = disallowed_tools
        if mcp_server_ids is not None:
            kwargs["mcp_server_ids"] = mcp_server_ids
        if globally_trusted_tools is not None:
            kwargs["globally_trusted_tools"] = globally_trusted_tools
        if additional_dirs is not None:
            kwargs["additional_dirs"] = additional_dirs
        if fallback_model is not None:
            kwargs["fallback_model"] = fallback_model
        async with self._db.session() as session:
            repo = SettingsRepository(session)
            entity = await repo.update_settings(**kwargs)
            await session.commit()
            if not entity:
                return {}
            return {
                "id": entity.id,
                "work_dir": entity.work_dir,
                "allowed_tools": entity.allowed_tools,
                "system_prompt": entity.system_prompt,
                "timeout_seconds": entity.timeout_seconds,
                "mode": entity.mode,
                "permission_mode": entity.permission_mode,
                "permission_required_tools": entity.permission_required_tools,
                "model": entity.model,
                "max_turns": entity.max_turns,
                "max_budget_usd": entity.max_budget_usd,
                "system_prompt_mode": entity.system_prompt_mode,
                "disallowed_tools": entity.disallowed_tools,
                "mcp_server_ids": entity.mcp_server_ids,
                "globally_trusted_tools": entity.globally_trusted_tools,
                "additional_dirs": entity.additional_dirs,
                "fallback_model": entity.fallback_model,
            }
