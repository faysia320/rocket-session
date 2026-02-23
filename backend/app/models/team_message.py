"""팀 메시지 모델."""

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TeamMessage(Base):
    """team_messages 테이블 ORM 모델.

    멤버 간 메시지 (세션이 아닌 멤버 기준).
    """

    __tablename__ = "team_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[str] = mapped_column(
        String, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    from_member_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False
    )
    to_member_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("team_members.id", ondelete="SET NULL"), default=None
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_type: Mapped[str] = mapped_column(String, nullable=False, default="info")
    metadata_json: Mapped[str | None] = mapped_column(Text, default=None)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index("idx_team_messages_team_id", "team_id"),
        Index("idx_team_messages_from_member", "from_member_id"),
        Index("idx_team_messages_team_created", "team_id", "created_at"),
    )
