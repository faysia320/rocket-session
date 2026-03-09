"""drop_team_tables

Revision ID: 73480a682def
Revises: 0030
Create Date: 2026-03-09 06:00:13.578316

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '73480a682def'
down_revision: Union[str, Sequence[str], None] = '0030'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop all team-related tables."""
    # FK 의존 순서: 자식 먼저 drop
    op.execute(text("DROP TABLE IF EXISTS team_messages CASCADE"))
    op.execute(text("DROP TABLE IF EXISTS team_tasks CASCADE"))
    op.execute(text("DROP TABLE IF EXISTS team_members CASCADE"))
    op.execute(text("DROP TABLE IF EXISTS teams CASCADE"))


def downgrade() -> None:
    """Team feature has been permanently removed."""
    raise NotImplementedError("Team feature has been permanently removed")
