"""global_settings: work_dir -> default_workspace_id, additional_dirs -> default_additional_workspace_ids
session_templates: work_dir, additional_dirs 제거

Revision ID: 0013
Revises: 0012
Create Date: 2026-02-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0013"
down_revision: Union[str, Sequence[str], None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── global_settings ──
    # work_dir 제거, default_workspace_id 추가
    op.add_column(
        "global_settings",
        sa.Column("default_workspace_id", sa.String(), nullable=True),
    )
    op.drop_column("global_settings", "work_dir")

    # additional_dirs -> default_additional_workspace_ids
    op.add_column(
        "global_settings",
        sa.Column("default_additional_workspace_ids", JSONB(), nullable=True),
    )
    op.drop_column("global_settings", "additional_dirs")

    # ── session_templates ──
    op.drop_column("session_templates", "work_dir")
    op.drop_column("session_templates", "additional_dirs")


def downgrade() -> None:
    # ── session_templates ──
    op.add_column(
        "session_templates",
        sa.Column("additional_dirs", JSONB(), nullable=True),
    )
    op.add_column(
        "session_templates",
        sa.Column("work_dir", sa.Text(), nullable=True),
    )

    # ── global_settings ──
    op.drop_column("global_settings", "default_additional_workspace_ids")
    op.add_column(
        "global_settings",
        sa.Column("additional_dirs", JSONB(), nullable=True),
    )
    op.drop_column("global_settings", "default_workspace_id")
    op.add_column(
        "global_settings",
        sa.Column("work_dir", sa.Text(), nullable=True),
    )
