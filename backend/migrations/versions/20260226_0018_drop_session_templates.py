"""session_templates 테이블 삭제.

Revision ID: 0018
Revises: 0017
Create Date: 2026-02-26
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("session_templates")


def downgrade() -> None:
    op.create_table(
        "session_templates",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), unique=True, nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("system_prompt", sa.Text()),
        sa.Column("allowed_tools", sa.Text()),
        sa.Column("disallowed_tools", sa.Text()),
        sa.Column("timeout_seconds", sa.Integer()),
        sa.Column("workflow_enabled", sa.Boolean(), server_default="false"),
        sa.Column("permission_mode", sa.Boolean(), server_default="false"),
        sa.Column("permission_required_tools", JSONB()),
        sa.Column("model", sa.String()),
        sa.Column("max_turns", sa.Integer()),
        sa.Column("max_budget_usd", sa.Float()),
        sa.Column("system_prompt_mode", sa.String(), server_default="replace"),
        sa.Column("mcp_server_ids", JSONB()),
        sa.Column("fallback_model", sa.String()),
        sa.Column(
            "workflow_definition_id",
            sa.String(),
            sa.ForeignKey("workflow_definitions.id", ondelete="SET NULL"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
