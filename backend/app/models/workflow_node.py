"""워크플로우 노드 모델."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class WorkflowNode(Base):
    """workflow_nodes 테이블 ORM 모델.

    워크플로우 단계의 기본 정의 (프롬프트, 제약조건 등)를 저장합니다.
    WorkflowDefinition의 steps에서 node_id로 참조됩니다.
    """

    __tablename__ = "workflow_nodes"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String, nullable=False)
    icon: Mapped[str] = mapped_column(String, nullable=False, default="FileText")
    prompt_template: Mapped[str] = mapped_column(Text, default="")
    constraints: Mapped[str] = mapped_column(String, nullable=False, default="readonly")
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
