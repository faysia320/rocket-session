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

    async def list_all(self) -> list[McpServer]:
        """전체 MCP 서버 목록 (최신순)."""
        result = await self._session.execute(
            select(McpServer).order_by(McpServer.created_at.desc())
        )
        return list(result.scalars().all())

    async def update_server(self, server_id: str, **kwargs) -> McpServer | None:
        """MCP 서버 속성 업데이트. kwargs에 있는 필드만 변경."""
        server = await self.get_by_id(server_id)
        if not server:
            return None
        for key, value in kwargs.items():
            setattr(server, key, value)
        await self._session.flush()
        return server

    async def get_by_ids(self, ids: list[str]) -> list[McpServer]:
        """ID 목록으로 MCP 서버 배치 조회."""
        if not ids:
            return []
        result = await self._session.execute(
            select(McpServer).where(McpServer.id.in_(ids))
        )
        return list(result.scalars().all())
