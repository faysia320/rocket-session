"""메모 블록 CRUD 서비스."""

import logging
import uuid

from app.core.exceptions import NotFoundError
from app.core.utils import utc_now
from app.models.memo_block import MemoBlock
from app.repositories.memo_block_repo import MemoBlockRepository
from app.schemas.memo import MemoBlockInfo
from app.services.base import DBService

logger = logging.getLogger(__name__)

SORT_ORDER_GAP = 1000


class MemoService(DBService):
    """메모 블록 CRUD 서비스."""

    async def list_blocks(self) -> list[MemoBlockInfo]:
        async with self._session_scope(MemoBlockRepository) as (session, repo):
            blocks = await repo.get_all_ordered()
            return [MemoBlockInfo.model_validate(b) for b in blocks]

    async def create_block(
        self, content: str = "", after_block_id: str | None = None
    ) -> MemoBlockInfo:
        block_id = str(uuid.uuid4())[:16]
        now = utc_now()

        async with self._session_scope(MemoBlockRepository) as (session, repo):
            sort_order = await self._calc_sort_order(repo, after_block_id)

            block = MemoBlock(
                id=block_id,
                content=content,
                sort_order=sort_order,
                created_at=now,
                updated_at=now,
            )
            await repo.add(block)
            await session.commit()
            return MemoBlockInfo.model_validate(block)

    async def update_block(self, block_id: str, content: str) -> MemoBlockInfo:
        async with self._session_scope(MemoBlockRepository) as (session, repo):
            block = await repo.get_by_id(block_id)
            if not block:
                raise NotFoundError(f"블록을 찾을 수 없습니다: {block_id}")
            block.content = content
            block.updated_at = utc_now()
            await session.commit()
            return MemoBlockInfo.model_validate(block)

    async def delete_block(self, block_id: str) -> bool:
        async with self._session_scope(MemoBlockRepository) as (session, repo):
            deleted = await repo.delete_by_id(block_id)
            if not deleted:
                raise NotFoundError(f"블록을 찾을 수 없습니다: {block_id}")
            await session.commit()
            return True

    async def reorder_blocks(self, block_ids: list[str]) -> list[MemoBlockInfo]:
        async with self._session_scope(MemoBlockRepository) as (session, repo):
            updates = [
                (bid, (i + 1) * SORT_ORDER_GAP)
                for i, bid in enumerate(block_ids)
            ]
            await repo.bulk_update_sort_orders(updates)
            await session.commit()
            blocks = await repo.get_all_ordered()
            return [MemoBlockInfo.model_validate(b) for b in blocks]

    # ── private helpers ──

    async def _calc_sort_order(
        self,
        repo: MemoBlockRepository,
        after_block_id: str | None,
    ) -> int:
        """새 블록의 sort_order를 계산."""
        if not after_block_id:
            return await repo.get_max_sort_order() + SORT_ORDER_GAP

        after_order = await repo.get_sort_order_by_id(after_block_id)
        if after_order is None:
            return await repo.get_max_sort_order() + SORT_ORDER_GAP

        next_order = await repo.get_next_block_sort_order(after_order)
        if next_order is None:
            return after_order + SORT_ORDER_GAP

        gap = next_order - after_order
        if gap > 1:
            return (after_order + next_order) // 2

        # 간격 부족 → 정규화 후 재계산
        await self._normalize_sort_orders(repo)
        after_order = await repo.get_sort_order_by_id(after_block_id)
        next_order = await repo.get_next_block_sort_order(after_order)  # type: ignore[arg-type]
        if next_order is None:
            return (after_order or 0) + SORT_ORDER_GAP
        return ((after_order or 0) + next_order) // 2

    async def _normalize_sort_orders(self, repo: MemoBlockRepository) -> None:
        """모든 블록의 sort_order를 SORT_ORDER_GAP 간격으로 재정렬."""
        blocks = await repo.get_all_ordered()
        updates = [
            (b.id, (i + 1) * SORT_ORDER_GAP) for i, b in enumerate(blocks)
        ]
        await repo.bulk_update_sort_orders(updates)
