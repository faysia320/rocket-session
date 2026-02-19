"""MCP 서버 관리 서비스."""

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.core.database import Database
from app.schemas.mcp import McpServerInfo

logger = logging.getLogger(__name__)

# ~/.claude/settings.json 경로
_CLAUDE_SETTINGS_PATH = Path.home() / ".claude" / "settings.json"


class McpService:
    """글로벌 MCP 서버 풀 관리 및 MCP config 빌드."""

    def __init__(self, db: Database) -> None:
        self._db = db

    @staticmethod
    def _row_to_info(row: dict) -> McpServerInfo:
        """DB row → McpServerInfo 변환 (JSON 필드 파싱)."""

        def _parse_json(val: str | None, default=None):
            if not val:
                return default
            try:
                return json.loads(val)
            except (json.JSONDecodeError, TypeError):
                return default

        return McpServerInfo(
            id=row["id"],
            name=row["name"],
            transport_type=row["transport_type"],
            command=row.get("command"),
            args=_parse_json(row.get("args")),
            url=row.get("url"),
            headers=_parse_json(row.get("headers")),
            env=_parse_json(row.get("env")),
            enabled=bool(row.get("enabled", 1)),
            source=row.get("source", "manual"),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    # ── CRUD ─────────────────────────────────────────────────

    async def list_servers(self) -> list[McpServerInfo]:
        rows = await self._db.list_mcp_servers()
        return [self._row_to_info(r) for r in rows]

    async def get_server(self, server_id: str) -> McpServerInfo | None:
        row = await self._db.get_mcp_server(server_id)
        return self._row_to_info(row) if row else None

    async def create_server(
        self,
        name: str,
        transport_type: str,
        command: str | None = None,
        args: list[str] | None = None,
        url: str | None = None,
        headers: dict[str, str] | None = None,
        env: dict[str, str] | None = None,
        enabled: bool = True,
        source: str = "manual",
    ) -> McpServerInfo:
        server_id = str(uuid.uuid4())[:16]
        now = datetime.now(timezone.utc).isoformat()
        row = await self._db.create_mcp_server(
            server_id=server_id,
            name=name,
            transport_type=transport_type,
            created_at=now,
            command=command,
            args=json.dumps(args) if args else None,
            url=url,
            headers=json.dumps(headers) if headers else None,
            env=json.dumps(env) if env else None,
            enabled=enabled,
            source=source,
        )
        return self._row_to_info(row)

    async def update_server(
        self,
        server_id: str,
        name: str | None = None,
        transport_type: str | None = None,
        command: str | None = None,
        args: list[str] | None = None,
        url: str | None = None,
        headers: dict[str, str] | None = None,
        env: dict[str, str] | None = None,
        enabled: bool | None = None,
    ) -> McpServerInfo | None:
        now = datetime.now(timezone.utc).isoformat()
        kwargs: dict = {"updated_at": now}
        if name is not None:
            kwargs["name"] = name
        if transport_type is not None:
            kwargs["transport_type"] = transport_type
        if command is not None:
            kwargs["command"] = command
        if args is not None:
            kwargs["args"] = json.dumps(args)
        if url is not None:
            kwargs["url"] = url
        if headers is not None:
            kwargs["headers"] = json.dumps(headers)
        if env is not None:
            kwargs["env"] = json.dumps(env)
        if enabled is not None:
            kwargs["enabled"] = enabled
        row = await self._db.update_mcp_server(server_id, **kwargs)
        return self._row_to_info(row) if row else None

    async def delete_server(self, server_id: str) -> bool:
        return await self._db.delete_mcp_server(server_id)

    # ── 시스템 MCP 서버 (~/.claude/settings.json) ──────────

    async def read_system_servers(self) -> list[dict]:
        """~/.claude/settings.json의 mcpServers 항목을 읽어 반환."""
        if not _CLAUDE_SETTINGS_PATH.exists():
            return []
        try:
            data = json.loads(_CLAUDE_SETTINGS_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("settings.json 읽기 실패: %s", e)
            return []

        mcp_servers = data.get("mcpServers", {})
        result = []
        for name, config in mcp_servers.items():
            # transport type 추론
            if config.get("command"):
                transport = "stdio"
            elif config.get("url"):
                transport = config.get("type", "sse")
            else:
                transport = "stdio"

            # 이미 import 했는지 확인
            existing = await self._db.get_mcp_server_by_name(name)

            result.append({
                "name": name,
                "transport_type": transport,
                "command": config.get("command"),
                "args": config.get("args"),
                "url": config.get("url"),
                "headers": config.get("headers"),
                "env": config.get("env"),
                "already_imported": existing is not None,
            })
        return result

    async def import_from_system(self, names: list[str] | None = None) -> list[McpServerInfo]:
        """시스템 MCP 서버를 DB에 import. names가 None이면 전체 import."""
        system_servers = await self.read_system_servers()
        imported = []
        for server in system_servers:
            if server["already_imported"]:
                continue
            if names and server["name"] not in names:
                continue
            info = await self.create_server(
                name=server["name"],
                transport_type=server["transport_type"],
                command=server.get("command"),
                args=server.get("args"),
                url=server.get("url"),
                headers=server.get("headers"),
                env=server.get("env"),
                source="system",
            )
            imported.append(info)
        return imported

    # ── MCP Config 빌드 ──────────────────────────────────

    async def build_mcp_config(
        self,
        server_ids: list[str],
        permission_mcp_dict: dict | None = None,
    ) -> dict:
        """선택된 MCP 서버 + Permission MCP를 병합한 config dict 반환.

        Returns:
            {"mcpServers": {"name1": {...}, "permission": {...}}} 형태의 dict
        """
        mcp_servers: dict[str, dict] = {}

        if server_ids:
            rows = await self._db.get_mcp_servers_by_ids(server_ids)
            for row in rows:
                if not row.get("enabled", 1):
                    continue
                info = self._row_to_info(row)
                entry: dict = {}
                if info.transport_type == "stdio":
                    if info.command:
                        entry["command"] = info.command
                    if info.args:
                        entry["args"] = info.args
                else:
                    if info.url:
                        entry["url"] = info.url
                    if info.headers:
                        entry["headers"] = info.headers
                    entry["type"] = info.transport_type
                if info.env:
                    entry["env"] = info.env
                mcp_servers[info.name] = entry

        if permission_mcp_dict:
            mcp_servers.update(permission_mcp_dict)

        return {"mcpServers": mcp_servers}
