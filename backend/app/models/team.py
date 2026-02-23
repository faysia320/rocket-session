"""팀 및 팀 멤버 모델."""

from sqlalchemy import ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Team(Base):
    """teams 테이블 ORM 모델."""

    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    lead_session_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("sessions.id", ondelete="SET NULL"), default=None
    )
    work_dir: Mapped[str] = mapped_column(Text, nullable=False)
    config: Mapped[dict | None] = mapped_column(JSONB, default=None)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    members: Mapped[list["TeamMember"]] = relationship(
        "TeamMember", back_populates="team", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_teams_status", "status"),
        Index("idx_teams_created_at", "created_at"),
    )


class TeamMember(Base):
    """team_members 테이블 ORM 모델."""

    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[str] = mapped_column(
        String, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    session_id: Mapped[str] = mapped_column(
        String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String, nullable=False, default="member")
    nickname: Mapped[str | None] = mapped_column(String, default=None)
    joined_at: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="members")

    __table_args__ = (
        UniqueConstraint("team_id", "session_id", name="uq_team_member_session"),
        Index("idx_team_members_team_id", "team_id"),
        Index("idx_team_members_session_id", "session_id"),
    )
