"""add_run_validation_to_qa_steps

시스템 워크플로우(workflow1, workflow2)의 QA 단계에 run_validation=True 추가.
Implement 단계에서 run_validation=False로 변경.

Revision ID: 0029
Revises: f2b87f65794b
Create Date: 2026-03-06 12:00:00.000000

"""
import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '0029'
down_revision: Union[str, Sequence[str], None] = 'f2b87f65794b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """QA 단계에 run_validation=True 추가, Implement에서 제거."""
    conn = op.get_bind()

    rows = conn.execute(
        sa.text("SELECT id, steps FROM workflow_definitions WHERE is_builtin = true")
    ).fetchall()

    for row in rows:
        def_id = row[0]
        steps = row[1]
        if not isinstance(steps, list):
            continue

        modified = False
        for step in steps:
            if not isinstance(step, dict):
                continue
            if step.get("name") == "qa" and not step.get("run_validation"):
                step["run_validation"] = True
                modified = True
            if step.get("name") == "implement" and step.get("run_validation"):
                step["run_validation"] = False
                modified = True

        if modified:
            conn.execute(
                sa.text(
                    "UPDATE workflow_definitions SET steps = CAST(:steps AS jsonb) WHERE id = :id"
                ),
                {"steps": json.dumps(steps), "id": def_id},
            )


def downgrade() -> None:
    """QA 단계에서 run_validation 제거, Implement에 복원."""
    conn = op.get_bind()

    rows = conn.execute(
        sa.text("SELECT id, steps FROM workflow_definitions WHERE is_builtin = true")
    ).fetchall()

    for row in rows:
        def_id = row[0]
        steps = row[1]
        if not isinstance(steps, list):
            continue

        modified = False
        for step in steps:
            if not isinstance(step, dict):
                continue
            if step.get("name") == "qa":
                step["run_validation"] = False
                modified = True
            if step.get("name") == "implement":
                step["run_validation"] = True
                modified = True

        if modified:
            conn.execute(
                sa.text(
                    "UPDATE workflow_definitions SET steps = CAST(:steps AS jsonb) WHERE id = :id"
                ),
                {"steps": json.dumps(steps), "id": def_id},
            )
