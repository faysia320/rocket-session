"""workflow_definitions에 is_default 컬럼 추가

사용자가 원하는 워크플로우를 기본(default)으로 설정할 수 있도록
is_default Boolean 컬럼을 추가합니다.
기존 is_builtin=true 행을 is_default=true로 초기화합니다.

Revision ID: 0023
Revises: 0022
Create Date: 2026-02-26
"""

import sqlalchemy as sa
from alembic import op

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workflow_definitions",
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.execute(
        "UPDATE workflow_definitions SET is_default = true WHERE is_builtin = true"
    )


def downgrade() -> None:
    op.drop_column("workflow_definitions", "is_default")
