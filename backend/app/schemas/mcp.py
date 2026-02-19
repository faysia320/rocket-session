"""MCP 서버 관련 Pydantic 스키마."""

from typing import Literal, Optional

from pydantic import BaseModel, Field

McpTransportType = Literal["stdio", "sse", "streamable-http"]


class CreateMcpServerRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    transport_type: McpTransportType
    command: Optional[str] = None
    args: Optional[list[str]] = None
    url: Optional[str] = None
    headers: Optional[dict[str, str]] = None
    env: Optional[dict[str, str]] = None
    enabled: bool = True


class UpdateMcpServerRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    transport_type: Optional[McpTransportType] = None
    command: Optional[str] = None
    args: Optional[list[str]] = None
    url: Optional[str] = None
    headers: Optional[dict[str, str]] = None
    env: Optional[dict[str, str]] = None
    enabled: Optional[bool] = None


class McpServerInfo(BaseModel):
    id: str
    name: str
    transport_type: McpTransportType
    command: Optional[str] = None
    args: Optional[list[str]] = None
    url: Optional[str] = None
    headers: Optional[dict[str, str]] = None
    env: Optional[dict[str, str]] = None
    enabled: bool = True
    source: str = "manual"
    created_at: str
    updated_at: str


class SystemMcpServer(BaseModel):
    """~/.claude/settings.json에서 읽은 MCP 서버 정보."""

    name: str
    transport_type: McpTransportType
    command: Optional[str] = None
    args: Optional[list[str]] = None
    url: Optional[str] = None
    headers: Optional[dict[str, str]] = None
    env: Optional[dict[str, str]] = None
    already_imported: bool = False


class ImportSystemRequest(BaseModel):
    names: Optional[list[str]] = None
