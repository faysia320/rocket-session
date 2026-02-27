"""메모 블록 관련 Pydantic 요청/응답 스키마."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MemoBlockInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    content: str
    sort_order: int
    created_at: datetime
    updated_at: datetime


class CreateMemoBlockRequest(BaseModel):
    content: str = Field(default="", max_length=50000)
    after_block_id: str | None = Field(
        None, description="이 블록 뒤에 삽입; null이면 맨 끝에 추가"
    )


class UpdateMemoBlockRequest(BaseModel):
    content: str = Field(..., max_length=50000)


class ReorderMemoBlocksRequest(BaseModel):
    """블록 순서 일괄 변경: 원하는 순서대로 나열된 블록 ID 목록."""

    block_ids: list[str]
