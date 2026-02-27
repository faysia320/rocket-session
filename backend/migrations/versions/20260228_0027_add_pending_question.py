"""sessions 테이블에 pending_question JSONB 컬럼 추가

AskUserQuestion 대기 질문을 DB에 영속 저장하여,
서버 재시작 후에도 세션 진입 시 질문 카드가 복원되도록 한다.

Revision ID: 0027
Revises: 0026
Create Date: 2026-02-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sessions", sa.Column("pending_question", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("sessions", "pending_question")
