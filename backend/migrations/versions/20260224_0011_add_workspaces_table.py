"""workspaces 테이블 추가 + sessions에 workspace_id 컬럼 추가

Git clone 기반 워크스페이스 시스템.

Revision ID: 0011
Revises: bb29a5676ecc
Create Date: 2026-02-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0011"
down_revision: Union[str, Sequence[str], None] = "bb29a5676ecc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # workspaces 테이블 생성
    op.create_table(
        "workspaces",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("repo_url", sa.Text(), nullable=False),
        sa.Column("branch", sa.String(), nullable=True),
        sa.Column("local_path", sa.Text(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="cloning"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("disk_usage_mb", sa.Integer(), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("auto_push", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_workspaces_status", "workspaces", ["status"])
    op.create_index("idx_workspaces_created_at", "workspaces", ["created_at"])

    # sessions에 workspace_id 추가
    op.add_column("sessions", sa.Column("workspace_id", sa.String(), nullable=True))
    op.create_index("idx_sessions_workspace_id", "sessions", ["workspace_id"])


def downgrade() -> None:
    op.drop_index("idx_sessions_workspace_id", table_name="sessions")
    op.drop_column("sessions", "workspace_id")
    op.drop_index("idx_workspaces_created_at", table_name="workspaces")
    op.drop_index("idx_workspaces_status", table_name="workspaces")
    op.drop_table("workspaces")
