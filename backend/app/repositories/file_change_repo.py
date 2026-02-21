"""파일 변경 Repository."""

from sqlalchemy import delete, func, select

from app.models.file_change import FileChange
from app.repositories.base import BaseRepository


class FileChangeRepository(BaseRepository[FileChange]):
    """file_changes 테이블 CRUD."""

    model_class = FileChange

    async def add_file_change(self, **kwargs) -> None:
        """단일 파일 변경 기록 추가."""
        fc = FileChange(**kwargs)
        self._session.add(fc)
        await self._session.flush()

    async def get_by_session(self, session_id: str) -> list[dict]:
        """세션의 파일 변경 기록 조회 (시간순)."""
        stmt = (
            select(FileChange.tool, FileChange.file, FileChange.timestamp)
            .where(FileChange.session_id == session_id)
            .order_by(FileChange.id)
        )
        result = await self._session.execute(stmt)
        return [dict(row._mapping) for row in result.all()]

    async def count_by_session(self, session_id: str) -> int:
        """세션의 파일 변경 수 조회."""
        stmt = (
            select(func.count())
            .select_from(FileChange)
            .where(FileChange.session_id == session_id)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def delete_by_session(self, session_id: str) -> None:
        """세션의 전체 파일 변경 기록 삭제."""
        stmt = delete(FileChange).where(FileChange.session_id == session_id)
        await self._session.execute(stmt)
