"""Claude Code Memory Pydantic 스키마."""

from typing import Literal

from pydantic import BaseModel

MemorySource = Literal["auto_memory", "claude_md", "rules"]


class MemoryFileInfo(BaseModel):
    """Memory 파일 메타데이터."""

    name: str
    relative_path: str
    source: MemorySource
    size_bytes: int


class MemoryFileContent(BaseModel):
    """Memory 파일 내용."""

    name: str
    relative_path: str
    source: MemorySource
    content: str


class MemoryContextResponse(BaseModel):
    """컨텍스트 주입용 Memory 응답."""

    memory_files: list[MemoryFileInfo]
    context_text: str
