"""global_settings에 globally_trusted_tools JSONB 컬럼 추가

Permission 신뢰 레벨 기능: "항상 허용" 도구 목록을 글로벌 설정에 저장.

Revision ID: 0003
Revises: 0002
Create Date: 2026-02-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "global_settings",
        sa.Column("globally_trusted_tools", JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("global_settings", "globally_trusted_tools")
