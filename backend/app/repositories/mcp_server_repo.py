"""MCP 서버 Repository."""

from sqlalchemy import select

from app.models.mcp_server import McpServer
from app.repositories.base import BaseRepository


class McpServerRepository(BaseRepository[McpServer]):
    """mcp_servers 테이블 CRUD."""

    model_class = McpServer

    async def get_by_name(self, name: str) -> McpServer | None:
        """서버 이름으로 조회."""
        result = await self._session.execute(
            select(McpServer).where(McpServer.name == name)
        )
        return result.scalar_one_or_none()

    async def get_by_ids(self, ids: list[str]) -> list[McpServer]:
        """ID 목록으로 MCP 서버 배치 조회."""
        if not ids:
            return []
        result = await self._session.execute(
            select(McpServer).where(McpServer.id.in_(ids))
        )
        return list(result.scalars().all())
