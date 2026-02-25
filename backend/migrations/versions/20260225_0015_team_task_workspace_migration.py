"""team_tasks: work_dir -> workspace_id 전환

Revision ID: 0015
Revises: 0014
Create Date: 2026-02-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # workspace_id 컬럼 추가
    op.add_column(
        "team_tasks",
        sa.Column("workspace_id", sa.String(), nullable=True),
    )
    op.create_foreign_key(
        "fk_team_tasks_workspace_id",
        "team_tasks",
        "workspaces",
        ["workspace_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 기존 work_dir → workspace_id 데이터 마이그레이션
    op.execute(
        """
        UPDATE team_tasks
        SET workspace_id = w.id
        FROM workspaces w
        WHERE team_tasks.work_dir = w.local_path
        """
    )

    # work_dir 컬럼 제거
    op.drop_column("team_tasks", "work_dir")


def downgrade() -> None:
    # work_dir 컬럼 복원
    op.add_column(
        "team_tasks",
        sa.Column("work_dir", sa.Text(), nullable=False, server_default="/tmp"),
    )

    # workspace_id → work_dir 데이터 복원
    op.execute(
        """
        UPDATE team_tasks
        SET work_dir = w.local_path
        FROM workspaces w
        WHERE team_tasks.workspace_id = w.id
        """
    )

    # workspace_id FK 및 컬럼 제거
    op.drop_constraint("fk_team_tasks_workspace_id", "team_tasks", type_="foreignkey")
    op.drop_column("team_tasks", "workspace_id")

    # server_default 제거
    op.alter_column("team_tasks", "work_dir", server_default=None)
