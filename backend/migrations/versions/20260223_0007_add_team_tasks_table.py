"""team_tasks 테이블 추가

공유 태스크 칸반 보드를 위한 team_tasks 테이블.

Revision ID: 0007
Revises: 0006
Create Date: 2026-02-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0007"
down_revision: Union[str, Sequence[str], None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "team_tasks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "team_id",
            sa.String(),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("priority", sa.String(), nullable=False, server_default="medium"),
        sa.Column(
            "assigned_session_id",
            sa.String(),
            sa.ForeignKey("sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_by_session_id",
            sa.String(),
            sa.ForeignKey("sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("result_summary", sa.Text(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "depends_on_task_id",
            sa.Integer(),
            sa.ForeignKey("team_tasks.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
    )
    op.create_index("idx_team_tasks_team_id", "team_tasks", ["team_id"])
    op.create_index("idx_team_tasks_status", "team_tasks", ["status"])
    op.create_index("idx_team_tasks_team_status", "team_tasks", ["team_id", "status"])


def downgrade() -> None:
    op.drop_index("idx_team_tasks_team_status", table_name="team_tasks")
    op.drop_index("idx_team_tasks_status", table_name="team_tasks")
    op.drop_index("idx_team_tasks_team_id", table_name="team_tasks")
    op.drop_table("team_tasks")
