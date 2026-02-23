"""팀 태스크 모델."""

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TeamTask(Base):
    """team_tasks 테이블 ORM 모델."""

    __tablename__ = "team_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[str] = mapped_column(
        String, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    priority: Mapped[str] = mapped_column(String, nullable=False, default="medium")
    assigned_session_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("sessions.id", ondelete="SET NULL"), default=None
    )
    created_by_session_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("sessions.id", ondelete="SET NULL"), default=None
    )
    result_summary: Mapped[str | None] = mapped_column(Text, default=None)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    depends_on_task_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("team_tasks.id", ondelete="SET NULL"), default=None
    )
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("idx_team_tasks_team_id", "team_id"),
        Index("idx_team_tasks_status", "status"),
        Index("idx_team_tasks_team_status", "team_id", "status"),
    )
