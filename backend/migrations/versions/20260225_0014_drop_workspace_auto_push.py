"""workspaces: auto_push 컬럼 제거

Revision ID: 0014
Revises: 0013
Create Date: 2026-02-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("workspaces", "auto_push")


def downgrade() -> None:
    op.add_column(
        "workspaces",
        sa.Column("auto_push", sa.Boolean(), nullable=False, server_default="false"),
    )
