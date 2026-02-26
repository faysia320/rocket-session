"""워크스페이스 Repository."""

from sqlalchemy import update

from app.models.workspace import Workspace
from app.repositories.base import BaseRepository


class WorkspaceRepository(BaseRepository[Workspace]):
    """workspaces 테이블 CRUD."""

    model_class = Workspace

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
