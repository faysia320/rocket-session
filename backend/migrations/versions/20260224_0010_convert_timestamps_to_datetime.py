"""Text 타임스탬프를 DateTime(timezone=True)로 변환.

모든 테이블의 타임스탬프 컬럼을 Text에서 DateTime(timezone=True)으로 마이그레이션.
PostgreSQL의 ::timestamptz 캐스트를 사용하여 기존 ISO 문자열을 자동 변환.

Revision ID: 0010
Revises: 0009, d606eb44b955
Create Date: 2026-02-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0010"
down_revision: Union[str, Sequence[str], None] = ("0a1b1cce6c48", "d606eb44b955")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 변환 대상: (테이블, 컬럼명) 튜플 목록
_COLUMNS = [
    ("sessions", "created_at"),
    ("messages", "timestamp"),
    ("events", "timestamp"),
    ("file_changes", "timestamp"),
    ("session_artifacts", "created_at"),
    ("session_artifacts", "updated_at"),
    ("artifact_annotations", "created_at"),
    ("mcp_servers", "created_at"),
    ("mcp_servers", "updated_at"),
    ("tags", "created_at"),
    ("session_tags", "created_at"),
    ("session_templates", "created_at"),
    ("session_templates", "updated_at"),
    ("teams", "created_at"),
    ("teams", "updated_at"),
    ("team_members", "created_at"),
    ("team_members", "updated_at"),
    ("team_tasks", "created_at"),
    ("team_tasks", "updated_at"),
    ("team_messages", "created_at"),
]


def upgrade() -> None:
    for table, column in _COLUMNS:
        op.alter_column(
            table,
            column,
            type_=sa.DateTime(timezone=True),
            postgresql_using=f"{column}::timestamptz",
        )


def downgrade() -> None:
    for table, column in _COLUMNS:
        op.alter_column(
            table,
            column,
            type_=sa.Text(),
            postgresql_using=f"{column}::text",
        )
