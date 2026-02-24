"""세션 아티팩트 및 인라인 주석 모델."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class SessionArtifact(Base):
    """session_artifacts 테이블 ORM 모델.

    워크플로우의 각 단계(research, plan) 산출물을 저장합니다.
    """

    __tablename__ = "session_artifacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    phase: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String, default="draft")
    version: Mapped[int] = mapped_column(Integer, default=1)
    parent_artifact_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("session_artifacts.id", ondelete="SET NULL"), default=None
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Relationships
    annotations: Mapped[list["ArtifactAnnotation"]] = relationship(
        "ArtifactAnnotation",
        back_populates="artifact",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        Index("idx_session_artifacts_session_id", "session_id"),
        Index("idx_session_artifacts_session_phase", "session_id", "phase"),
    )


class ArtifactAnnotation(Base):
    """artifact_annotations 테이블 ORM 모델.

    아티팩트에 대한 인라인 주석(사용자 피드백)을 저장합니다.
    """

    __tablename__ = "artifact_annotations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    artifact_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("session_artifacts.id", ondelete="CASCADE"),
        nullable=False,
    )
    line_start: Mapped[int] = mapped_column(Integer, nullable=False)
    line_end: Mapped[int | None] = mapped_column(Integer, default=None)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    annotation_type: Mapped[str] = mapped_column(String, default="comment")
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Relationships
    artifact: Mapped["SessionArtifact"] = relationship(
        "SessionArtifact", back_populates="annotations"
    )

    __table_args__ = (Index("idx_artifact_annotations_artifact_id", "artifact_id"),)
