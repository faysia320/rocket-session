"""workflow_nodes 테이블 추가 및 기존 steps JSONB에서 Node 분리

Revision ID: 0019
Revises: 0018
Create Date: 2026-02-26
"""

import json
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. workflow_nodes 테이블 생성
    op.create_table(
        "workflow_nodes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("icon", sa.String(), nullable=False, server_default="FileText"),
        sa.Column("prompt_template", sa.Text(), server_default=""),
        sa.Column(
            "constraints", sa.String(), nullable=False, server_default="readonly"
        ),
        sa.Column("is_builtin", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # 2. 기존 steps에서 고유 Node 추출 (builtin def 우선)
    conn = op.get_bind()
    rows = conn.execute(
        text(
            "SELECT id, is_builtin, steps FROM workflow_definitions "
            "ORDER BY is_builtin DESC"
        )
    )

    seen_names: dict[str, str] = {}  # name → node_id
    for row in rows:
        steps = json.loads(row.steps) if isinstance(row.steps, str) else row.steps
        new_steps = []
        for step in steps or []:
            name = step.get("name", "")
            if not name:
                continue
            if name not in seen_names:
                node_id = str(uuid4())[:16]
                conn.execute(
                    text(
                        "INSERT INTO workflow_nodes "
                        "(id, name, label, icon, prompt_template, constraints, "
                        "is_builtin, created_at, updated_at) "
                        "VALUES (:id, :name, :label, :icon, :pt, :c, :bi, NOW(), NOW())"
                    ),
                    {
                        "id": node_id,
                        "name": name,
                        "label": step.get("label", name),
                        "icon": step.get("icon", "FileText"),
                        "pt": step.get("prompt_template", ""),
                        "c": step.get("constraints", "readonly"),
                        "bi": row.is_builtin,
                    },
                )
                seen_names[name] = node_id

            new_steps.append(
                {
                    "node_id": seen_names[name],
                    "order_index": step.get("order_index", 0),
                    "auto_advance": step.get("auto_advance", False),
                    "review_required": step.get("review_required", False),
                }
            )

        conn.execute(
            text("UPDATE workflow_definitions SET steps = :steps WHERE id = :id"),
            {"steps": json.dumps(new_steps), "id": row.id},
        )


def downgrade() -> None:
    # Node 속성을 steps에 다시 인라인 → workflow_nodes 드롭
    conn = op.get_bind()

    # 모든 노드 정보 조회
    nodes = conn.execute(
        text(
            "SELECT id, name, label, icon, prompt_template, constraints FROM workflow_nodes"
        )
    )
    node_map = {
        r.id: {
            "name": r.name,
            "label": r.label,
            "icon": r.icon,
            "prompt_template": r.prompt_template,
            "constraints": r.constraints,
        }
        for r in nodes
    }

    rows = conn.execute(text("SELECT id, steps FROM workflow_definitions"))
    for row in rows:
        steps = json.loads(row.steps) if isinstance(row.steps, str) else row.steps
        restored = []
        for step in steps or []:
            node_id = step.get("node_id", "")
            node_data = node_map.get(node_id, {})
            restored.append(
                {
                    "name": node_data.get("name", "unknown"),
                    "label": node_data.get("label", "Unknown"),
                    "icon": node_data.get("icon", "FileText"),
                    "prompt_template": node_data.get("prompt_template", ""),
                    "constraints": node_data.get("constraints", "readonly"),
                    "order_index": step.get("order_index", 0),
                    "auto_advance": step.get("auto_advance", False),
                    "review_required": step.get("review_required", False),
                }
            )
        conn.execute(
            text("UPDATE workflow_definitions SET steps = :steps WHERE id = :id"),
            {"steps": json.dumps(restored), "id": row.id},
        )

    op.drop_table("workflow_nodes")
