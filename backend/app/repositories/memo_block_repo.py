"""메모 블록 Repository."""

from sqlalchemy import func, select

from app.models.memo_block import MemoBlock
from app.repositories.base import BaseRepository


class MemoBlockRepository(BaseRepository[MemoBlock]):
    """memo_blocks 테이블 CRUD."""

    model_class = MemoBlock

    async def get_all_ordered(self) -> list[MemoBlock]:
        """sort_order 순으로 전체 블록 조회."""
        stmt = select(MemoBlock).order_by(MemoBlock.sort_order.asc())
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_max_sort_order(self) -> int:
        """현재 최대 sort_order 조회."""
        stmt = select(func.coalesce(func.max(MemoBlock.sort_order), 0))
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def get_sort_order_by_id(self, block_id: str) -> int | None:
        """특정 블록의 sort_order 조회."""
        stmt = select(MemoBlock.sort_order).where(MemoBlock.id == block_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_next_block_sort_order(self, after_sort_order: int) -> int | None:
        """지정 sort_order 바로 다음 블록의 sort_order 조회."""
        stmt = (
            select(MemoBlock.sort_order)
            .where(MemoBlock.sort_order > after_sort_order)
            .order_by(MemoBlock.sort_order.asc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def bulk_update_sort_orders(
        self, updates: list[tuple[str, int]]
    ) -> None:
        """배치로 sort_order 업데이트. updates: [(id, new_sort_order), ...]"""
        for block_id, new_order in updates:
            block = await self.get_by_id(block_id)
            if block:
                block.sort_order = new_order
        await self._session.flush()
