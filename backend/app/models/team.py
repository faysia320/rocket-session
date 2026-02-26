"""팀 및 팀 멤버(페르소나) 모델."""

from datetime import datetime

from sqlalchemy import DateTime, Float, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy import ForeignKey
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
    lead_member_id: Mapped[int | None] = mapped_column(Integer, default=None)
    config: Mapped[dict | None] = mapped_column(JSONB, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Relationships
    members: Mapped[list["TeamMember"]] = relationship(
        "TeamMember", back_populates="team", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_teams_status", "status"),
        Index("idx_teams_created_at", "created_at"),
    )


class TeamMember(Base):
    """team_members 테이블 ORM 모델.

    멤버는 세션이 아닌 페르소나(역할 정의)입니다.
    세션은 태스크 위임 시 멤버의 설정으로 동적 생성됩니다.
    """

    __tablename__ = "team_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[str] = mapped_column(
        String, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String, nullable=False, default="member")
    nickname: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, default=None)

    # 세션 생성 설정 (페르소나 템플릿)
    system_prompt: Mapped[str | None] = mapped_column(Text, default=None)
    allowed_tools: Mapped[str | None] = mapped_column(Text, default=None)
    disallowed_tools: Mapped[str | None] = mapped_column(Text, default=None)
    model: Mapped[str | None] = mapped_column(String, default=None)
    max_turns: Mapped[int | None] = mapped_column(Integer, default=None)
    max_budget_usd: Mapped[float | None] = mapped_column(Float, default=None)
    mcp_server_ids: Mapped[list | None] = mapped_column(JSONB, default=None)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="members")

    __table_args__ = (
        UniqueConstraint("team_id", "nickname", name="uq_team_member_nickname"),
        Index("idx_team_members_team_id", "team_id"),
    )
