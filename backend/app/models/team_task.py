"""팀 태스크 모델."""

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TeamTask(Base):
    """team_tasks 테이블 ORM 모델.

    태스크는 고유한 work_dir을 가지며,
    위임 시 멤버 설정 + 태스크 work_dir로 세션이 동적 생성됩니다.
    """

    __tablename__ = "team_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[str] = mapped_column(
        String, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    priority: Mapped[str] = mapped_column(String, nullable=False, default="medium")
    assigned_member_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("team_members.id", ondelete="SET NULL"), default=None
    )
    created_by_member_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("team_members.id", ondelete="SET NULL"), default=None
    )
    work_dir: Mapped[str] = mapped_column(Text, nullable=False)
    session_id: Mapped[str | None] = mapped_column(
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
        Index("idx_team_tasks_session_id", "session_id"),
    )
