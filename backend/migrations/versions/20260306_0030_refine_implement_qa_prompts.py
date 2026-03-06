"""Implement/QA 프롬프트 역할 분리.

- Implement: 검증 결과 보고 제거 → 변경 사항 요약에 집중
- QA: 빌드/테스트 중복 검증 제거 → 코드 리뷰에 집중
- WF1/WF2 QA 프롬프트 분리 (Plan 참조 vs Research 참조)

Revision ID: 0030
Revises: 0029
Create Date: 2026-03-06
"""

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0030"
down_revision: Union[str, None] = "0029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ── 새 Implement 프롬프트 (WF1: Plan 기반) ──────────────────────
_WF1_IMPLEMENT_PROMPT = (
    "## 확정된 구현 계획 (Plan Artifact)\n{previous_artifact}\n\n"
    "## 지시사항\n"
    "위 확정된 계획에 따라 실제 코드 구현을 시작하세요.\n\n"
    "### 실행 지침\n"
    "- **원자적(Atomic) 작업 진행:** 한 번에 너무 많은 파일을 덮어쓰지 말고, "
    "논리적인 단계별로 나누어 수정하세요.\n"
    "- **지속적인 진행:** 모든 구현 단계가 완료될 때까지 작업을 멈추지 마세요.\n"
    "- **자가 수정(Self-Correction):** 구현 과정에서 빌드/린트 에러가 발생하면 "
    "즉시 포기하지 말고, 에러 로그를 분석하여 스스로 수정하세요.\n"
    "- **최종 빌드 확인:** 모든 코드 작성이 끝나면 반드시 빌드 및 린트를 실행하여 "
    "에러가 없는 상태로 만드세요. 에러가 남아있다면 수정 후 다시 확인하세요.\n\n"
    "### 최종 리포트\n"
    "모든 구현이 완료되면, 다음 항목만 포함한 요약 보고서를 마크다운으로 출력하세요:\n"
    "- 변경 및 추가된 파일 목록\n"
    "- 각 파일의 주요 변경 사항 요약 (무엇을, 왜 변경했는지)\n\n"
    "## 요청\n{user_prompt}"
)

# ── 새 Implement 프롬프트 (WF2: Research 기반) ──────────────────
_WF2_IMPLEMENT_PROMPT = (
    "## 이전 단계의 분석 결과 (Research Artifact)\n{previous_artifact}\n\n"
    "## 지시사항\n"
    "위 분석 결과와 해결 방향성을 바탕으로 즉시 코드 수정을 진행하세요.\n\n"
    "### 실행 지침\n"
    "- **논스톱 실행:** 사용자에게 추가적인 컨펌을 받지 말고, "
    "작업이 완료될 때까지 구현을 멈추지 마세요.\n"
    "- **자가 수정(Self-Correction):** 구현 후 반드시 빌드 및 린트(Lint)를 "
    "실행하세요. 에러가 발생하면 작업을 중단하지 말고, 에러 로그를 분석하여 "
    "스스로 코드를 수정하세요. (최대 3회 시도)\n\n"
    "### 최종 리포트\n"
    "모든 구현이 완료되면, 다음 내용을 마크다운으로 짧게 보고하세요:\n"
    "- 변경된 파일 목록\n"
    "- 구체적으로 어떤 코드를 어떻게 고쳤는지(또는 추가했는지) 요약\n\n"
    "## 요청\n{user_prompt}"
)

# ── 새 QA 프롬프트 (WF1: Plan 기준 검증) ────────────────────────
_WF1_QA_PROMPT = (
    "## 구현 결과 (Implement Artifact)\n{previous_artifact}\n\n"
    "## QA 코드 리뷰 지시사항\n"
    "당신은 독립적인 코드 리뷰어입니다. "
    "위 구현 보고서를 **참고만** 하되, 변경된 파일을 직접 읽고 검증하세요.\n\n"
    "### 참고\n"
    "- 빌드 및 테스트 통과 여부는 시스템이 이미 자동으로 검증했습니다.\n"
    "- 당신은 **코드 품질 리뷰**에 집중하세요.\n\n"
    "### 검증 항목\n"
    "변경된 파일을 직접 읽고 다음을 평가하세요:\n"
    "1. **완성도:** Plan에서 명시한 모든 변경사항이 빠짐없이 구현되었는가\n"
    "2. **코드 품질:** 프로젝트의 기존 패턴과 코드 스타일을 따르는가\n"
    "3. **엣지 케이스:** 예외 상황, 경계값, 에러 처리가 적절한가\n"
    "4. **보안:** 하드코딩된 시크릿, SQL 인젝션, XSS 등 보안 취약점이 없는가\n\n"
    "### 출력 형식\n"
    "각 항목을 아래 형식으로 출력:\n"
    "- [PASS] 항목명: 근거 설명\n"
    "- [FAIL] 항목명: 문제점과 수정 제안\n"
    "- [WARN] 항목명: 주의 사항\n\n"
    "### 요약\n"
    "마지막에 전체 결과 요약 (N/M 통과) 및 종합 의견을 작성하세요.\n\n"
    "{user_prompt}"
)

# ── 새 QA 프롬프트 (WF2: Research 기준 검증) ────────────────────
_WF2_QA_PROMPT = (
    "## 구현 결과 (Implement Artifact)\n{previous_artifact}\n\n"
    "## QA 코드 리뷰 지시사항\n"
    "당신은 독립적인 코드 리뷰어입니다. "
    "위 구현 보고서를 **참고만** 하되, 변경된 파일을 직접 읽고 검증하세요.\n\n"
    "### 참고\n"
    "- 빌드 및 테스트 통과 여부는 시스템이 이미 자동으로 검증했습니다.\n"
    "- 당신은 **코드 품질 리뷰**에 집중하세요.\n\n"
    "### 검증 항목\n"
    "변경된 파일을 직접 읽고 다음을 평가하세요:\n"
    "1. **완성도:** Research 분석에서 파악한 문제가 정확히 해결되었는가\n"
    "2. **코드 품질:** 프로젝트의 기존 패턴과 코드 스타일을 따르는가\n"
    "3. **엣지 케이스:** 예외 상황, 경계값, 에러 처리가 적절한가\n"
    "4. **보안:** 하드코딩된 시크릿, SQL 인젝션, XSS 등 보안 취약점이 없는가\n\n"
    "### 출력 형식\n"
    "각 항목을 아래 형식으로 출력:\n"
    "- [PASS] 항목명: 근거 설명\n"
    "- [FAIL] 항목명: 문제점과 수정 제안\n"
    "- [WARN] 항목명: 주의 사항\n\n"
    "### 요약\n"
    "마지막에 전체 결과 요약 (N/M 통과) 및 종합 의견을 작성하세요.\n\n"
    "{user_prompt}"
)


def upgrade() -> None:
    """Implement/QA 프롬프트 역할 분리."""
    conn = op.get_bind()

    rows = conn.execute(
        sa.text("SELECT id, name, steps FROM workflow_definitions WHERE is_builtin = true")
    ).fetchall()

    for row in rows:
        def_id = row[0]
        name = row[1]
        steps = row[2]
        if not isinstance(steps, list):
            continue

        # WF1 판별: plan 단계가 있으면 WF1, 없으면 WF2
        has_plan = any(s.get("name") == "plan" for s in steps if isinstance(s, dict))

        modified = False
        for step in steps:
            if not isinstance(step, dict):
                continue

            if step.get("name") == "implement":
                step["prompt_template"] = (
                    _WF1_IMPLEMENT_PROMPT if has_plan else _WF2_IMPLEMENT_PROMPT
                )
                modified = True

            elif step.get("name") == "qa":
                step["prompt_template"] = (
                    _WF1_QA_PROMPT if has_plan else _WF2_QA_PROMPT
                )
                modified = True

        if modified:
            conn.execute(
                sa.text(
                    "UPDATE workflow_definitions SET steps = CAST(:steps AS jsonb), "
                    "updated_at = NOW() WHERE id = :id"
                ),
                {"steps": json.dumps(steps), "id": def_id},
            )


def downgrade() -> None:
    """이전 프롬프트로 복원 (0028 기준)."""
    conn = op.get_bind()

    # 0028 마이그레이션의 원본 프롬프트
    _old_wf1_implement_prompt = (
        "## 확정된 구현 계획 (Plan Artifact)\n{previous_artifact}\n\n"
        "## 지시사항\n"
        "위 확정된 계획에 따라 실제 코드 구현을 시작하세요. \n\n"
        "### 실행 지침\n"
        "- **원자적(Atomic) 작업 진행:** 한 번에 너무 많은 파일을 덮어쓰지 말고, 논리적인 단계별로 나누어 수정하세요.\n"
        "- **지속적인 진행:** 모든 구현 단계가 완료될 때까지 작업을 멈추지 마세요.\n"
        "- **자가 수정(Self-Correction):** 구현 과정이나 빌드/린트 검증 중 에러가 발생할 경우, 즉시 포기하거나 멈추지 마세요. 에러 로그를 분석하여 스스로 수정을 시도하세요.\n"
        "- **최종 검증:** 모든 코드 작성이 끝나면 반드시 빌드 및 린트 검증, (가능하다면) 테스트 코드를 실행하여 정상 작동 여부를 확인하세요.\n\n"
        "### 최종 리포트 작성\n"
        "모든 작업과 검증이 성공적으로 완료되면, 다음 항목을 포함한 요약 보고서를 마크다운으로 출력하세요:\n"
        "- 최종적으로 변경 및 추가된 파일 목록\n"
        "- 주요 변경 사항 요약\n"
        "- 실행된 검증 단계 (빌드, 린트 등)의 최종 결과\n\n"
        "## 요청\n{user_prompt}"
    )

    _old_wf2_implement_prompt = (
        "## 이전 단계의 분석 결과 (Research Artifact)\n{previous_artifact}\n\n"
        "## 지시사항\n"
        "위 분석 결과와 해결 방향성을 바탕으로 **즉시 코드 수정을 진행하세요.** "
        "### 실행 지침\n"
        "- **논스톱 실행:** 사용자에게 추가적인 컨펌을 받지 말고, 작업이 완료될 때까지 구현을 멈추지 마세요.\n"
        "- **자가 수정(Self-Correction):** 구현 후 반드시 빌드 및 린트(Lint) 검증을 수행하세요. 에러가 발생하면 작업을 중단하지 말고, 에러 로그를 분석하여 스스로 코드를 수정하세요. (최대 3회 시도)\n\n"
        "### 최종 리포트\n"
        "모든 작업과 에러 수정이 성공적으로 완료되면, 다음 내용을 마크다운으로 짧게 보고하세요:\n"
        "- 변경된 파일 목록\n"
        "- 구체적으로 어떤 코드를 어떻게 고쳤는지(또는 추가했는지) 요약\n"
        "- 빌드/린트 테스트 통과 여부\n\n"
        "## 요청\n{user_prompt}"
    )

    _old_qa_prompt = (
        "## 구현 결과 (Implement Artifact)\n{previous_artifact}\n\n"
        "## QA 검증 지시사항\n"
        "위 구현 결과를 다음 기준으로 검증하고, "
        "각 항목에 **PASS/FAIL/WARN** + 근거를 체크리스트로 출력하세요.\n\n"
        "### 검증 항목\n"
        "1. Plan의 모든 변경사항이 구현되었는가\n"
        "2. 빌드/컴파일 에러가 없는가\n"
        "3. 기존 테스트가 통과하는가\n"
        "4. 코드 스타일(lint)을 준수하는가\n"
        "5. 엣지 케이스가 처리되었는가\n"
        "6. 보안 취약점이 없는가\n\n"
        "### 출력 형식\n"
        "각 항목을 아래 형식으로 출력:\n"
        "- [PASS] 항목명: 근거 설명\n"
        "- [FAIL] 항목명: 문제점과 수정 제안\n"
        "- [WARN] 항목명: 주의 사항\n\n"
        "### 요약\n"
        "마지막에 전체 결과 요약 (N/M 통과) 및 종합 의견을 작성하세요.\n\n"
        "{user_prompt}"
    )

    rows = conn.execute(
        sa.text("SELECT id, steps FROM workflow_definitions WHERE is_builtin = true")
    ).fetchall()

    for row in rows:
        def_id = row[0]
        steps = row[1]
        if not isinstance(steps, list):
            continue

        has_plan = any(s.get("name") == "plan" for s in steps if isinstance(s, dict))

        modified = False
        for step in steps:
            if not isinstance(step, dict):
                continue

            if step.get("name") == "implement":
                step["prompt_template"] = (
                    _old_wf1_implement_prompt if has_plan else _old_wf2_implement_prompt
                )
                modified = True

            elif step.get("name") == "qa":
                step["prompt_template"] = _old_qa_prompt
                modified = True

        if modified:
            conn.execute(
                sa.text(
                    "UPDATE workflow_definitions SET steps = CAST(:steps AS jsonb), "
                    "updated_at = NOW() WHERE id = :id"
                ),
                {"steps": json.dumps(steps), "id": def_id},
            )
