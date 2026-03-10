"""MCP 서버 모델."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class McpServer(Base):
    """mcp_servers 테이블 ORM 모델."""

    __tablename__ = "mcp_servers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    transport_type: Mapped[str] = mapped_column(String, nullable=False, default="stdio")
    command: Mapped[str | None] = mapped_column(Text, default=None)
    args: Mapped[list | None] = mapped_column(JSONB, default=None)
    url: Mapped[str | None] = mapped_column(Text, default=None)
    headers: Mapped[dict | None] = mapped_column(JSONB, default=None)
    env: Mapped[dict | None] = mapped_column(JSONB, default=None)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    docker_service_name: Mapped[str | None] = mapped_column(String, default=None)
    source: Mapped[str] = mapped_column(String, nullable=False, default="manual")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
