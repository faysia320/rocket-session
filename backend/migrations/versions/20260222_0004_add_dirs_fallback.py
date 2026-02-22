"""sessions, global_settings, session_templates에 additional_dirs, fallback_model 추가

멀티 디렉토리 지원 (--add-dir) 및 폴백 모델 (--fallback-model) 기능.

Revision ID: 0004
Revises: 0003
Create Date: 2026-02-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # sessions
    op.add_column("sessions", sa.Column("additional_dirs", JSONB(), nullable=True))
    op.add_column("sessions", sa.Column("fallback_model", sa.String(), nullable=True))
    # global_settings
    op.add_column(
        "global_settings", sa.Column("additional_dirs", JSONB(), nullable=True)
    )
    op.add_column(
        "global_settings", sa.Column("fallback_model", sa.String(), nullable=True)
    )
    # session_templates
    op.add_column(
        "session_templates", sa.Column("additional_dirs", JSONB(), nullable=True)
    )
    op.add_column(
        "session_templates", sa.Column("fallback_model", sa.String(), nullable=True)
    )


def downgrade() -> None:
    for table in ["session_templates", "global_settings", "sessions"]:
        op.drop_column(table, "fallback_model")
        op.drop_column(table, "additional_dirs")
