"""공통 응답 스키마."""

from pydantic import BaseModel


class StatusResponse(BaseModel):
    """DELETE 및 액션 응답 공통 스키마."""

    status: str


class MarkReadResponse(BaseModel):
    """읽음 처리 응답."""

    marked: int
