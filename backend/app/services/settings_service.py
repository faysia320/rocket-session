"""글로벌 설정 관리 서비스."""

import json
import logging

from app.core.database import Database

logger = logging.getLogger(__name__)


class SettingsService:
    """글로벌 기본 설정 조회/수정 서비스."""

    def __init__(self, db: Database) -> None:
        self._db = db

    async def get(self) -> dict:
        """글로벌 설정을 딕셔너리로 반환. permission_mode는 bool, permission_required_tools는 list."""
        row = await self._db.get_global_settings()
        if not row:
            return {}
        result = dict(row)
        # permission_mode: int → bool
        result["permission_mode"] = bool(result.get("permission_mode", 0))
        # permission_required_tools: JSON string → list
        prt = result.get("permission_required_tools")
        if prt and isinstance(prt, str):
            try:
                result["permission_required_tools"] = json.loads(prt)
            except (json.JSONDecodeError, TypeError):
                result["permission_required_tools"] = None
        return result

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
    ) -> dict:
        """글로벌 설정 업데이트 후 최신 상태 반환."""
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
            kwargs["permission_mode"] = int(permission_mode)
        if permission_required_tools is not None:
            kwargs["permission_required_tools"] = json.dumps(permission_required_tools)
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
        await self._db.update_global_settings(**kwargs)
        return await self.get()
