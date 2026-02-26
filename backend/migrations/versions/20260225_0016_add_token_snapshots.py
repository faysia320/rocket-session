"""token_snapshots 테이블 추가 — 세션 삭제와 무관한 토큰 사용량 영구 보존

Revision ID: 0016
Revises: 0015
Create Date: 2026-02-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "token_snapshots",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.String(), nullable=False),
        sa.Column("work_dir", sa.Text(), nullable=False),
        sa.Column("workflow_phase", sa.String(), nullable=True),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "cache_creation_tokens", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "cache_read_tokens", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_token_snapshots_session_id", "token_snapshots", ["session_id"])
    op.create_index("idx_token_snapshots_timestamp", "token_snapshots", ["timestamp"])
    op.create_index(
        "idx_token_snapshots_workflow_phase", "token_snapshots", ["workflow_phase"]
    )
    op.create_index("idx_token_snapshots_work_dir", "token_snapshots", ["work_dir"])

    # 기존 messages 데이터를 token_snapshots로 복사 (data migration)
    op.execute(
        """
        INSERT INTO token_snapshots
            (session_id, work_dir, workflow_phase, model,
             input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens,
             timestamp)
        SELECT
            m.session_id,
            s.work_dir,
            NULL,
            m.model,
            COALESCE(m.input_tokens, 0),
            COALESCE(m.output_tokens, 0),
            COALESCE(m.cache_creation_tokens, 0),
            COALESCE(m.cache_read_tokens, 0),
            m.timestamp
        FROM messages m
        JOIN sessions s ON m.session_id = s.id
        WHERE m.role = 'assistant'
          AND m.message_type IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index("idx_token_snapshots_work_dir", table_name="token_snapshots")
    op.drop_index("idx_token_snapshots_workflow_phase", table_name="token_snapshots")
    op.drop_index("idx_token_snapshots_timestamp", table_name="token_snapshots")
    op.drop_index("idx_token_snapshots_session_id", table_name="token_snapshots")
    op.drop_table("token_snapshots")
