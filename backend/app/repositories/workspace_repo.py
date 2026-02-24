"""워크스페이스 Repository."""

from sqlalchemy import select, update

from app.models.workspace import Workspace
from app.repositories.base import BaseRepository


class WorkspaceRepository(BaseRepository[Workspace]):
    """workspaces 테이블 CRUD."""

    model_class = Workspace

    async def list_all(self) -> list[Workspace]:
        """전체 워크스페이스 목록 (생성일 내림차순)."""
        result = await self._session.execute(
            select(Workspace).order_by(Workspace.created_at.desc())
        )
        return list(result.scalars().all())

    async def update_status(
        self,
        workspace_id: str,
        status: str,
        error_message: str | None = None,
        **kwargs,
    ) -> None:
        """워크스페이스 상태 업데이트."""
        values: dict = {"status": status, "error_message": error_message}
        values.update(kwargs)
        await self._session.execute(
            update(Workspace).where(Workspace.id == workspace_id).values(**values)
        )

    async def update_workspace(self, workspace_id: str, **kwargs) -> Workspace | None:
        """워크스페이스 속성 업데이트."""
        ws = await self.get_by_id(workspace_id)
        if not ws:
            return None
        for key, value in kwargs.items():
            setattr(ws, key, value)
        await self._session.flush()
        return ws
