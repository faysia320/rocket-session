"""MCP 서버 관리 서비스."""

import json
import logging
import os
import re
import uuid
from pathlib import Path

from app.core.exceptions import NotFoundError
from app.core.utils import utc_now
from app.models.mcp_server import McpServer
from app.repositories.mcp_server_repo import McpServerRepository
from app.schemas.mcp import McpServerInfo
from app.services.base import DBService

logger = logging.getLogger(__name__)

# ~/.claude/settings.json 경로
_CLAUDE_SETTINGS_PATH = Path.home() / ".claude" / "settings.json"

# Docker 컨테이너 내부 실행 여부
_RUNNING_IN_DOCKER = os.path.exists("/.dockerenv")


def _resolve_url_for_docker(url: str) -> str:
    """Docker 컨테이너 내부에서 localhost/127.0.0.1 URL을 host.docker.internal로 변환."""
    if not _RUNNING_IN_DOCKER or not url:
        return url
    return re.sub(
        r"://(localhost|127\.0\.0\.1)([:/?])",
        r"://host.docker.internal\2",
        url,
    )


class McpService(DBService):
    """글로벌 MCP 서버 풀 관리 및 MCP config 빌드."""

    # ── CRUD ─────────────────────────────────────────────────

    async def list_servers(self) -> list[McpServerInfo]:
        async with self._session_scope(McpServerRepository) as (session, repo):
            servers = await repo.get_all_ordered(McpServer.created_at.desc())
            return [McpServerInfo.model_validate(s) for s in servers]

    async def get_server(self, server_id: str) -> McpServerInfo | None:
        async with self._session_scope(McpServerRepository) as (session, repo):
            server = await repo.get_by_id(server_id)
            return McpServerInfo.model_validate(server) if server else None

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
        now = utc_now()
        async with self._session_scope(McpServerRepository) as (session, repo):
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
            return McpServerInfo.model_validate(server)

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
    ) -> McpServerInfo:
        now = utc_now()
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
        async with self._session_scope(McpServerRepository) as (session, repo):
            server = await repo.update_by_id(server_id, **kwargs)
            if not server:
                raise NotFoundError(f"MCP 서버를 찾을 수 없습니다: {server_id}")
            await session.commit()
            return McpServerInfo.model_validate(server)

    async def delete_server(self, server_id: str) -> bool:
        async with self._session_scope(McpServerRepository) as (session, repo):
            deleted = await repo.delete_by_id(server_id)
            if not deleted:
                raise NotFoundError(f"MCP 서버를 찾을 수 없습니다: {server_id}")
            await session.commit()
            return True

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
        async with self._session_scope(McpServerRepository) as (session, repo):
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
            async with self._session_scope(McpServerRepository) as (session, repo):
                entities = await repo.get_by_ids(server_ids)
                for server in entities:
                    if not server.enabled:
                        continue
                    info = McpServerInfo.model_validate(server)
                    entry: dict = {}
                    if info.transport_type == "stdio":
                        if info.command:
                            entry["command"] = info.command
                        if info.args:
                            entry["args"] = info.args
                    else:
                        if info.url:
                            entry["url"] = _resolve_url_for_docker(info.url)
                        if info.headers:
                            entry["headers"] = info.headers
                        entry["type"] = info.transport_type
                    if info.env:
                        entry["env"] = info.env
                    mcp_servers[info.name] = entry

        if permission_mcp_dict:
            mcp_servers.update(permission_mcp_dict)

        return {"mcpServers": mcp_servers}
