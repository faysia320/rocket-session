"""MCP 서버 관리 서비스."""

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.core.database import Database
from app.models.mcp_server import McpServer
from app.repositories.mcp_server_repo import McpServerRepository
from app.schemas.mcp import McpServerInfo

logger = logging.getLogger(__name__)

# ~/.claude/settings.json 경로
_CLAUDE_SETTINGS_PATH = Path.home() / ".claude" / "settings.json"


class McpService:
    """글로벌 MCP 서버 풀 관리 및 MCP config 빌드."""

    def __init__(self, db: Database) -> None:
        self._db = db

    @staticmethod
    def _entity_to_info(server: McpServer) -> McpServerInfo:
        """McpServer ORM 엔티티 → McpServerInfo 변환. JSONB는 이미 Python 객체."""
        return McpServerInfo(
            id=server.id,
            name=server.name,
            transport_type=server.transport_type,
            command=server.command,
            args=server.args,
            url=server.url,
            headers=server.headers,
            env=server.env,
            enabled=server.enabled,
            source=server.source,
            created_at=server.created_at,
            updated_at=server.updated_at,
        )

    # ── CRUD ─────────────────────────────────────────────────

    async def list_servers(self) -> list[McpServerInfo]:
        async with self._db.session() as session:
            repo = McpServerRepository(session)
            servers = await repo.list_all()
            return [self._entity_to_info(s) for s in servers]

    async def get_server(self, server_id: str) -> McpServerInfo | None:
        async with self._db.session() as session:
            repo = McpServerRepository(session)
            server = await repo.get_by_id(server_id)
            return self._entity_to_info(server) if server else None

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
        async with self._db.session() as session:
            repo = McpServerRepository(session)
            server = McpServer(
                id=server_id,
                name=name,
                transport_type=transport_type,
                command=command,
                args=args,
                url=url,
                headers=headers,
                env=env,
                enabled=enabled,
                source=source,
                created_at=now,
                updated_at=now,
            )
            await repo.add(server)
            await session.commit()
            return self._entity_to_info(server)

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
            kwargs["args"] = args
        if url is not None:
            kwargs["url"] = url
        if headers is not None:
            kwargs["headers"] = headers
        if env is not None:
            kwargs["env"] = env
        if enabled is not None:
            kwargs["enabled"] = enabled
        async with self._db.session() as session:
            repo = McpServerRepository(session)
            server = await repo.update_server(server_id, **kwargs)
            await session.commit()
            return self._entity_to_info(server) if server else None

    async def delete_server(self, server_id: str) -> bool:
        async with self._db.session() as session:
            repo = McpServerRepository(session)
            deleted = await repo.delete_by_id(server_id)
            await session.commit()
            return deleted

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
        async with self._db.session() as session:
            repo = McpServerRepository(session)
            for name, config in mcp_servers.items():
                # transport type 추론
                if config.get("command"):
                    transport = "stdio"
                elif config.get("url"):
                    transport = config.get("type", "sse")
                else:
                    transport = "stdio"

                # 이미 import 했는지 확인
                existing = await repo.get_by_name(name)

                result.append(
                    {
                        "name": name,
                        "transport_type": transport,
                        "command": config.get("command"),
                        "args": config.get("args"),
                        "url": config.get("url"),
                        "headers": config.get("headers"),
                        "env": config.get("env"),
                        "already_imported": existing is not None,
                    }
                )
        return result

    async def import_from_system(
        self, names: list[str] | None = None
    ) -> list[McpServerInfo]:
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
            async with self._db.session() as session:
                repo = McpServerRepository(session)
                entities = await repo.get_by_ids(server_ids)
                for server in entities:
                    if not server.enabled:
                        continue
                    info = self._entity_to_info(server)
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
