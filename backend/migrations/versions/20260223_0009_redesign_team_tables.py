"""팀 테이블 재설계: 멤버 = 페르소나, 세션 = 온디맨드

멤버를 세션에서 분리하여 페르소나(역할 정의)로 전환.
팀에서 work_dir 제거, 태스크에 work_dir 귀속.
태스크에 실행 세션 ID 추가.

Revision ID: 0009
Revises: 0008
Create Date: 2026-02-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: Union[str, Sequence[str], None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 기존 테이블 역순 삭제 (FK 의존성 순서)
    op.drop_table("team_messages")
    op.drop_table("team_tasks")
    op.drop_table("team_members")
    op.drop_table("teams")

    # 새 teams 테이블 (work_dir 삭제, lead_member_id로 변경)
    op.create_table(
        "teams",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("lead_member_id", sa.Integer(), nullable=True),
        sa.Column("config", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
    )
    op.create_index("idx_teams_status", "teams", ["status"])
    op.create_index("idx_teams_created_at", "teams", ["created_at"])

    # 새 team_members 테이블 (페르소나 정의, session_id 삭제)
    op.create_table(
        "team_members",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "team_id",
            sa.String(),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(), nullable=False, server_default="member"),
        sa.Column("nickname", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("system_prompt", sa.Text(), nullable=True),
        sa.Column("allowed_tools", sa.Text(), nullable=True),
        sa.Column("disallowed_tools", sa.Text(), nullable=True),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("max_turns", sa.Integer(), nullable=True),
        sa.Column("max_budget_usd", sa.Float(), nullable=True),
        sa.Column("mcp_server_ids", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.UniqueConstraint("team_id", "nickname", name="uq_team_member_nickname"),
    )
    op.create_index("idx_team_members_team_id", "team_members", ["team_id"])

    # 새 team_tasks 테이블 (member_id 기반, work_dir 추가, session_id 추가)
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
            "assigned_member_id",
            sa.Integer(),
            sa.ForeignKey("team_members.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_by_member_id",
            sa.Integer(),
            sa.ForeignKey("team_members.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("work_dir", sa.Text(), nullable=False),
        sa.Column(
            "session_id",
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
    op.create_index("idx_team_tasks_session_id", "team_tasks", ["session_id"])

    # 새 team_messages 테이블 (member_id 기반)
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
            "from_member_id",
            sa.Integer(),
            sa.ForeignKey("team_members.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "to_member_id",
            sa.Integer(),
            sa.ForeignKey("team_members.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("message_type", sa.String(), nullable=False, server_default="info"),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.Text(), nullable=False),
    )
    op.create_index("idx_team_messages_team_id", "team_messages", ["team_id"])
    op.create_index(
        "idx_team_messages_from_member", "team_messages", ["from_member_id"]
    )
    op.create_index(
        "idx_team_messages_team_created", "team_messages", ["team_id", "created_at"]
    )


def downgrade() -> None:
    # 새 테이블 삭제
    op.drop_table("team_messages")
    op.drop_table("team_tasks")
    op.drop_table("team_members")
    op.drop_table("teams")

    # 기존 테이블 복원 (0006~0008 마이그레이션 내용)
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
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.Text(), nullable=False),
    )
    op.create_index("idx_team_messages_team_id", "team_messages", ["team_id"])
    op.create_index(
        "idx_team_messages_from_session", "team_messages", ["from_session_id"]
    )
    op.create_index(
        "idx_team_messages_team_created", "team_messages", ["team_id", "created_at"]
    )
