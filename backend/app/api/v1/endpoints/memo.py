"""메모 블록 CRUD REST 엔드포인트."""

from fastapi import APIRouter, Depends

from app.api.dependencies import get_memo_service
from app.schemas.common import StatusResponse
from app.schemas.memo import (
    CreateMemoBlockRequest,
    MemoBlockInfo,
    ReorderMemoBlocksRequest,
    UpdateMemoBlockRequest,
)
from app.services.memo_service import MemoService

router = APIRouter(prefix="/memo", tags=["memo"])


@router.get("/blocks", response_model=list[MemoBlockInfo])
async def list_blocks(
    service: MemoService = Depends(get_memo_service),
):
    return await service.list_blocks()


@router.post("/blocks", response_model=MemoBlockInfo, status_code=201)
async def create_block(
    req: CreateMemoBlockRequest,
    service: MemoService = Depends(get_memo_service),
):
    return await service.create_block(
        content=req.content, after_block_id=req.after_block_id
    )


@router.patch("/blocks/{block_id}", response_model=MemoBlockInfo)
async def update_block(
    block_id: str,
    req: UpdateMemoBlockRequest,
    service: MemoService = Depends(get_memo_service),
):
    return await service.update_block(block_id, content=req.content)


@router.delete("/blocks/{block_id}", response_model=StatusResponse)
async def delete_block(
    block_id: str,
    service: MemoService = Depends(get_memo_service),
):
    await service.delete_block(block_id)
    return StatusResponse(status="deleted")


@router.put("/blocks/reorder", response_model=list[MemoBlockInfo])
async def reorder_blocks(
    req: ReorderMemoBlocksRequest,
    service: MemoService = Depends(get_memo_service),
):
    return await service.reorder_blocks(req.block_ids)
