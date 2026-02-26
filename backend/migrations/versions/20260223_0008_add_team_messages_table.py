"""team_messages 테이블 추가

팀 내 메시지 통신을 위한 team_messages 테이블.

Revision ID: 0008
Revises: 0007
Create Date: 2026-02-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0008"
down_revision: Union[str, Sequence[str], None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "team_messages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "team_id",
            sa.String(),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "from_session_id",
            sa.String(),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "to_session_id",
            sa.String(),
            sa.ForeignKey("sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("message_type", sa.String(), nullable=False, server_default="info"),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.Text(), nullable=False),
    )
    op.create_index("idx_team_messages_team_id", "team_messages", ["team_id"])
    op.create_index(
        "idx_team_messages_from_session", "team_messages", ["from_session_id"]
    )
    op.create_index(
        "idx_team_messages_team_created",
        "team_messages",
        ["team_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_team_messages_team_created", table_name="team_messages")
    op.drop_index("idx_team_messages_from_session", table_name="team_messages")
    op.drop_index("idx_team_messages_team_id", table_name="team_messages")
    op.drop_table("team_messages")
