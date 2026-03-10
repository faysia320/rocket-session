"""workflow_definitions에 sort_order 컬럼 추가

Revision ID: 0024
Revises: 0023
Create Date: 2026-02-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # sort_order 컬럼 추가
    op.add_column(
        "workflow_definitions",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )

    # 기본 워크플로우 정렬 순서 설정
    op.execute(
        "UPDATE workflow_definitions SET sort_order = 1 WHERE id = 'default-workflow'"
    )


def downgrade() -> None:
    op.drop_column("workflow_definitions", "sort_order")
