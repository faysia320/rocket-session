"""Base Repository - 공통 CRUD 패턴."""

from typing import Generic, TypeVar

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Base

T = TypeVar("T", bound=Base)


class BaseRepository(Generic[T]):
    """제네릭 Base Repository. 서브클래스에서 model_class를 지정."""

    model_class: type[T]

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_id(self, entity_id: str | int) -> T | None:
        """ID로 엔티티 조회."""
        return await self._session.get(self.model_class, entity_id)

    async def get_all(self) -> list[T]:
        """전체 엔티티 조회."""
        result = await self._session.execute(select(self.model_class))
        return list(result.scalars().all())

    async def add(self, entity: T) -> T:
        """엔티티 추가 후 flush."""
        self._session.add(entity)
        await self._session.flush()
        return entity

    async def delete_by_id(self, entity_id: str | int) -> bool:
        """ID로 엔티티 삭제. 삭제 성공 여부 반환."""
        stmt = delete(self.model_class).where(self.model_class.id == entity_id)
        result = await self._session.execute(stmt)
        return result.rowcount > 0
