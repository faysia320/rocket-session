"""add_validation_commands_to_workspaces

Revision ID: f2b87f65794b
Revises: 0028
Create Date: 2026-03-06 04:27:00.864013

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f2b87f65794b'
down_revision: Union[str, Sequence[str], None] = '0028'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('workspaces', sa.Column('validation_commands', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('workspaces', 'validation_commands')
