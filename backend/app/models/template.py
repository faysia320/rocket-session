"""세션 템플릿 모델."""

from sqlalchemy import Boolean, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SessionTemplate(Base):
    """session_templates 테이블 ORM 모델."""

    __tablename__ = "session_templates"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    work_dir: Mapped[str | None] = mapped_column(Text, default=None)
    system_prompt: Mapped[str | None] = mapped_column(Text, default=None)
    allowed_tools: Mapped[str | None] = mapped_column(Text, default=None)
    disallowed_tools: Mapped[str | None] = mapped_column(Text, default=None)
    timeout_seconds: Mapped[int | None] = mapped_column(Integer, default=None)
    mode: Mapped[str] = mapped_column(String, default="normal")
    permission_mode: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    permission_required_tools: Mapped[list | None] = mapped_column(JSONB, default=None)
    model: Mapped[str | None] = mapped_column(String, default=None)
    max_turns: Mapped[int | None] = mapped_column(Integer, default=None)
    max_budget_usd: Mapped[float | None] = mapped_column(Float, default=None)
    system_prompt_mode: Mapped[str] = mapped_column(String, default="replace")
    mcp_server_ids: Mapped[list | None] = mapped_column(JSONB, default=None)
    additional_dirs: Mapped[list | None] = mapped_column(JSONB, default=None)
    fallback_model: Mapped[str | None] = mapped_column(String, default=None)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)
