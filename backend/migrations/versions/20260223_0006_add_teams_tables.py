"""teams 및 team_members 테이블 추가

Agent Team (멀티 에이전트 협업) 기능: 여러 세션을 팀으로 그룹핑하여 협업.

Revision ID: 0006
Revises: 0a1b1cce6c48
Create Date: 2026-02-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: Union[str, Sequence[str], None] = "0a1b1cce6c48"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # teams 테이블
    op.create_table(
        "teams",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column(
            "lead_session_id",
            sa.String(),
            sa.ForeignKey("sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("work_dir", sa.Text(), nullable=False),
        sa.Column("config", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
    )
    op.create_index("idx_teams_status", "teams", ["status"])
    op.create_index("idx_teams_created_at", "teams", ["created_at"])

    # team_members 테이블
    op.create_table(
        "team_members",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "team_id",
            sa.String(),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            sa.String(),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(), nullable=False, server_default="member"),
        sa.Column("nickname", sa.String(), nullable=True),
        sa.Column("joined_at", sa.Text(), nullable=False),
        sa.UniqueConstraint("team_id", "session_id", name="uq_team_member_session"),
    )
    op.create_index("idx_team_members_team_id", "team_members", ["team_id"])
    op.create_index("idx_team_members_session_id", "team_members", ["session_id"])


def downgrade() -> None:
    op.drop_index("idx_team_members_session_id", table_name="team_members")
    op.drop_index("idx_team_members_team_id", table_name="team_members")
    op.drop_table("team_members")
    op.drop_index("idx_teams_created_at", table_name="teams")
    op.drop_index("idx_teams_status", table_name="teams")
    op.drop_table("teams")
