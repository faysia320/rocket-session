"""태그 관련 Pydantic 요청/응답 스키마."""

from pydantic import BaseModel, Field


class TagInfo(BaseModel):
    id: str
    name: str
    color: str


class CreateTagRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: str = Field(default="#6366f1", pattern=r"^#[0-9a-fA-F]{6}$")


class UpdateTagRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50)
    color: str | None = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class SessionTagRequest(BaseModel):
    tag_ids: list[str]
