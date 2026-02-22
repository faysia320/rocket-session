"""글로벌 설정 모델."""

from sqlalchemy import Boolean, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GlobalSettings(Base):
    """global_settings 테이블 ORM 모델."""

    __tablename__ = "global_settings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default="default")
    work_dir: Mapped[str | None] = mapped_column(Text, default=None)
    allowed_tools: Mapped[str | None] = mapped_column(Text, default=None)
    system_prompt: Mapped[str | None] = mapped_column(Text, default=None)
    timeout_seconds: Mapped[int | None] = mapped_column(Integer, default=None)
    mode: Mapped[str | None] = mapped_column(String, default="normal")
    permission_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    permission_required_tools: Mapped[list | None] = mapped_column(JSONB, default=None)
    model: Mapped[str | None] = mapped_column(String, default=None)
    max_turns: Mapped[int | None] = mapped_column(Integer, default=None)
    max_budget_usd: Mapped[float | None] = mapped_column(Float, default=None)
    system_prompt_mode: Mapped[str | None] = mapped_column(String, default="replace")
    disallowed_tools: Mapped[str | None] = mapped_column(Text, default=None)
    mcp_server_ids: Mapped[list | None] = mapped_column(JSONB, default=None)
    additional_dirs: Mapped[list | None] = mapped_column(JSONB, default=None)
    fallback_model: Mapped[str | None] = mapped_column(String, default=None)
    globally_trusted_tools: Mapped[list | None] = mapped_column(JSONB, default=None)
