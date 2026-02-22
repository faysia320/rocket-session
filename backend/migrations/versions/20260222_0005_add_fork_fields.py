"""sessions에 parent_session_id, forked_at_message_id 추가

세션 포크/분기 기능: 특정 시점에서 대화를 복제하여 다른 접근법 시도.

Revision ID: 0005
Revises: 0004
Create Date: 2026-02-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sessions", sa.Column("parent_session_id", sa.String(), nullable=True)
    )
    op.add_column(
        "sessions", sa.Column("forked_at_message_id", sa.Integer(), nullable=True)
    )
    op.create_index(
        "idx_sessions_parent_session_id", "sessions", ["parent_session_id"]
    )


def downgrade() -> None:
    op.drop_index("idx_sessions_parent_session_id", table_name="sessions")
    op.drop_column("sessions", "forked_at_message_id")
    op.drop_column("sessions", "parent_session_id")
