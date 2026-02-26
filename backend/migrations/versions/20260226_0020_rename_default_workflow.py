"""rename default workflow definition to 'Default'

Revision ID: 0020
Revises: 0019
Create Date: 2026-02-26
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE workflow_definitions
        SET name = 'Default'
        WHERE id = 'default-workflow'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE workflow_definitions
        SET name = 'Default (Research → Plan → Implement)'
        WHERE id = 'default-workflow'
        """
    )
