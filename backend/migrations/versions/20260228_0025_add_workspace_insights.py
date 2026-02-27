"""workspace_insights 테이블 추가 — 세션 지식 시스템

워크스페이스별 인사이트를 저장하는 테이블을 생성합니다.

Revision ID: 0025b
Revises: 0025
Create Date: 2026-02-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0025b"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "workspace_insights",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("workspace_id", sa.String(), nullable=False),
        sa.Column("session_id", sa.String(), nullable=True),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("relevance_score", sa.Float(), server_default="1.0"),
        sa.Column("tags", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("file_paths", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column("is_auto_generated", sa.Boolean(), server_default="true"),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "idx_workspace_insights_workspace_id",
        "workspace_insights",
        ["workspace_id"],
    )
    op.create_index(
        "idx_workspace_insights_category",
        "workspace_insights",
        ["category"],
    )
    op.create_index(
        "idx_workspace_insights_workspace_category",
        "workspace_insights",
        ["workspace_id", "category"],
    )
    op.create_index(
        "idx_workspace_insights_session_id",
        "workspace_insights",
        ["session_id"],
    )


def downgrade() -> None:
    op.drop_table("workspace_insights")
