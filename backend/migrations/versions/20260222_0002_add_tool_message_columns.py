"""messages 테이블에 tool_use/tool_result 관련 컬럼 추가

tool_use, tool_result 메시지를 messages 테이블에 저장하여
세션 히스토리 로딩 시 전체 대화 흐름을 복원할 수 있도록 함.

Revision ID: 0002
Revises: 0001
Create Date: 2026-02-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("message_type", sa.String(), nullable=True))
    op.add_column("messages", sa.Column("tool_use_id", sa.String(), nullable=True))
    op.add_column("messages", sa.Column("tool_name", sa.String(), nullable=True))
    op.add_column("messages", sa.Column("tool_input", JSONB(), nullable=True))
    op.create_index(
        "idx_messages_session_message_type",
        "messages",
        ["session_id", "message_type"],
    )


def downgrade() -> None:
    op.drop_index("idx_messages_session_message_type", table_name="messages")
    op.drop_column("messages", "tool_input")
    op.drop_column("messages", "tool_name")
    op.drop_column("messages", "tool_use_id")
    op.drop_column("messages", "message_type")
