"""system-workflow-4 삭제 및 Workflow 1·2에 QA 단계 추가.

- Workflow 1 (default-workflow): Research > Plan > Implement → + QA Review
- Workflow 2 (system-workflow-2): Research > Implement → + QA Review
- Workflow 4 (system-workflow-4): 삭제 (QA 단계가 각 워크플로우에 통합됨)

Revision ID: 0028
Revises: 0027
Create Date: 2026-03-02
"""

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0028"
down_revision: Union[str, None] = "0027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ── QA 단계 공통 정의 ─────────────────────────────────────────
_QA_STEP_TEMPLATE = {
    "name": "qa",
    "label": "QA Review",
    "icon": "CheckCircle",
    "prompt_template": (
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
    ),
    "constraints": "readonly",
    "review_required": True,
}

# ── Workflow 1 (default-workflow): Research > Plan > Implement > QA ──
_DEFAULT_WORKFLOW_STEPS = [
    {
        "name": "research",
        "label": "Research",
        "icon": "Search",
        "prompt_template": (
            "## 지시사항\n"
            "아래 요청에 대해 코드베이스를 깊이 탐색하고 **분석 결과만** 마크다운으로 정리하세요.\n\n"
            "### 분석 항목\n"
            "- **관련 파일 및 함수 목록**\n"
            "- **동작 방식 및 데이터 흐름:** 현재 코드의 로직과 데이터가 어떻게 흘러가는지 파악\n"
            "- **아키텍처 및 환경:** 사용 중인 프레임워크/라이브러리 환경, 아키텍처 패턴 및 의존성 관계\n"
            "- **잠재적 사이드 이펙트 및 파급 범위:** 변경 시 영향을 받을 수 있는 다른 모듈이나 컴포넌트 식별\n"
            "- **제약사항 및 엣지 케이스(Edge Cases):** 현재 구현의 한계점이나 미처 고려되지 않은 예외 상황\n\n"
            "### 금지 사항\n"
            "- **구현 계획, 변경 제안, 해결 방안을 절대 작성하지 마세요.**\n"
            "- **어떠한 코드도 수정하거나 구현하지 마세요.**\n"
            "- 계획 작성은 다음 단계(Plan)에서 별도로 수행됩니다.\n"
            "- 이 단계에서는 오직 현재 상태의 객관적인 분석과 발견 사항만 보고하세요.\n\n"
            "## 요청\n{user_prompt}"
        ),
        "constraints": "readonly",
        "order_index": 0,
        "review_required": False,
    },
    {
        "name": "plan",
        "label": "Plan",
        "icon": "FileText",
        "prompt_template": (
            "## 이전 단계의 분석 결과 (Research Artifact)\n{previous_artifact}\n\n"
            "## 지시사항\n"
            "위 분석 결과를 바탕으로 상세한 구현 계획을 마크다운으로 작성하세요. \n\n"
            "### 포함할 내용\n"
            "- **변경할 파일 목록 및 구체적인 코드 변경 내용**\n"
            "- **작업 순서(Step-by-step):** 논리적인 구현 순서\n"
            "- **테스트 및 검증 전략:** 변경 후 정상 동작을 확인하기 위한 테스트 방법 (단위 테스트, 수동 테스트 시나리오 등)\n"
            "- **예상되는 리스크 및 대안(Fallback):** 계획대로 진행되지 않을 경우의 대비책\n\n"
            "### 금지 사항\n"
            "- **중요: 아직 실제 코드를 수정하거나 구현하지 마세요.**\n"
            "- 코드를 작성하는 명령어(작업)를 실행하지 마세요.\n\n"
            "### 📌 출력 마무리에 필수 추가 사항\n"
            "모든 계획 작성이 끝나면, 출력의 제일 마지막에 반드시 다음 문구를 추가하여 사용자의 피드백을 요청하세요:\n"
            '> *"위 계획대로 구현을 시작할까요? 아니면 수정하거나 추가하고 싶은 부분이 있나요?"*\n\n'
            "## 요청\n{user_prompt}"
        ),
        "constraints": "readonly",
        "order_index": 1,
        "review_required": True,
    },
    {
        "name": "implement",
        "label": "Implement",
        "icon": "Code",
        "prompt_template": (
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
        ),
        "constraints": "full",
        "order_index": 2,
        "review_required": False,
    },
    {**_QA_STEP_TEMPLATE, "order_index": 3},
]

# ── Workflow 2 (system-workflow-2): Research > Implement > QA ──
_WF2_STEPS = [
    {
        "name": "research",
        "label": "Research",
        "icon": "Search",
        "prompt_template": (
            "## 지시사항\n"
            "아래 요청에 대해 코드베이스를 탐색하고, **빠르고 정확한 분석 결과**를 마크다운으로 정리하세요.\n\n"
            "### 핵심 분석 항목\n"
            "- **타겟 파일 및 위치:** 수정이나 추가가 필요한 구체적인 파일과 코드 라인 파악\n"
            "- **에러 원인 / 현재 로직 파악:** 버그인 경우 근본 원인 파악, 기능 추가인 경우 삽입 지점의 컨텍스트 파악\n"
            "- **해결 방향성 요약:** 코드를 어떻게 수정할 것인지에 대한 핵심적인 방향성 (단, 실제 코드는 작성하지 마세요)\n\n"
            "### 금지 사항\n"
            "- **직접적으로 코드를 수정하거나 구현하지 마세요.**\n"
            "- 장황한 아키텍처 분석이나 불필요한 전체 파일 탐색은 생략하고, 요청과 직결된 부분만 분석하세요.\n\n"
            "## 요청\n{user_prompt}"
        ),
        "constraints": "readonly",
        "order_index": 0,
        "review_required": True,
    },
    {
        "name": "implement",
        "label": "Implement",
        "icon": "Code",
        "prompt_template": (
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
        ),
        "constraints": "full",
        "order_index": 1,
        "review_required": False,
    },
    {**_QA_STEP_TEMPLATE, "order_index": 2},
]


def upgrade() -> None:
    # 1. Workflow 1 — steps 업데이트 + description 변경
    # (id가 'default-workflow' 또는 name이 'Workflow 1'인 레코드 매칭)
    op.execute(
        sa.text(
            """
            UPDATE workflow_definitions
            SET steps = :steps,
                description = '안정성: 복잡한 구조 변경 (Research > Plan > Implement > QA)',
                updated_at = NOW()
            WHERE id = 'default-workflow' OR name = 'Workflow 1'
            """
        ).bindparams(steps=json.dumps(_DEFAULT_WORKFLOW_STEPS))
    )

    # 2. Workflow 2 — steps 업데이트 + description 변경
    # (id가 UUID로 변경된 환경 대응: name 기준 매칭)
    op.execute(
        sa.text(
            """
            UPDATE workflow_definitions
            SET steps = :steps,
                description = '속도: 단순 버그/기능 (Research > Implement > QA)',
                updated_at = NOW()
            WHERE name = 'Workflow 2'
            """
        ).bindparams(steps=json.dumps(_WF2_STEPS))
    )

    # 3. Workflow 4 — 삭제 (QA가 각 워크플로우에 통합됨)
    op.execute(
        "DELETE FROM workflow_definitions WHERE name = 'Workflow 4'"
    )


def downgrade() -> None:
    # Workflow 4 복원 (0026 마이그레이션의 QA_WORKFLOW 데이터)
    _qa_workflow_steps = [
        {
            "name": "research",
            "label": "Research",
            "icon": "Search",
            "prompt_template": (
                "## 지시사항\n"
                "아래 요청에 대해 코드베이스를 깊이 탐색하고 **분석 결과만** 마크다운으로 정리하세요.\n\n"
                "### 분석 항목\n"
                "- **관련 파일 및 함수 목록**\n"
                "- **동작 방식 및 데이터 흐름**\n"
                "- **아키텍처 및 환경**\n"
                "- **잠재적 사이드 이펙트 및 파급 범위**\n"
                "- **제약사항 및 엣지 케이스**\n\n"
                "### 금지 사항\n"
                "- 구현 계획, 변경 제안, 해결 방안을 절대 작성하지 마세요.\n"
                "- 어떠한 코드도 수정하거나 구현하지 마세요.\n\n"
                "## 요청\n{user_prompt}"
            ),
            "constraints": "readonly",
            "order_index": 0,
            "review_required": False,
        },
        {
            "name": "plan",
            "label": "Plan",
            "icon": "FileText",
            "prompt_template": (
                "## 이전 단계의 분석 결과 (Research Artifact)\n{previous_artifact}\n\n"
                "## 지시사항\n"
                "위 분석 결과를 바탕으로 상세한 구현 계획을 마크다운으로 작성하세요.\n\n"
                "### 포함할 내용\n"
                "- 변경할 파일 목록 및 구체적인 코드 변경 내용\n"
                "- 작업 순서(Step-by-step)\n"
                "- 테스트 및 검증 전략\n"
                "- 예상되는 리스크 및 대안\n\n"
                "### 금지 사항\n"
                "- 아직 실제 코드를 수정하거나 구현하지 마세요.\n\n"
                "## 요청\n{user_prompt}"
            ),
            "constraints": "readonly",
            "order_index": 1,
            "review_required": True,
        },
        {
            "name": "implement",
            "label": "Implement",
            "icon": "Code",
            "prompt_template": (
                "## 확정된 구현 계획 (Plan Artifact)\n{previous_artifact}\n\n"
                "## 지시사항\n"
                "위 확정된 계획에 따라 실제 코드 구현을 시작하세요.\n\n"
                "### 실행 지침\n"
                "- 원자적(Atomic) 작업 진행\n"
                "- 모든 구현 단계가 완료될 때까지 작업을 멈추지 마세요\n"
                "- 에러 발생 시 자가 수정\n"
                "- 최종 빌드/린트 검증\n\n"
                "### 최종 리포트\n"
                "변경 파일 목록, 주요 변경 사항, 검증 결과를 요약하세요.\n\n"
                "## 요청\n{user_prompt}"
            ),
            "constraints": "full",
            "order_index": 2,
            "review_required": False,
        },
        {**_QA_STEP_TEMPLATE, "order_index": 3},
    ]
    op.execute(
        sa.text(
            """
            INSERT INTO workflow_definitions
                (id, name, description, is_builtin, is_default, sort_order, steps, created_at, updated_at)
            VALUES
                ('system-workflow-4', 'Workflow 4',
                 '검증: 구현 후 QA 자동 검증 (Research > Plan > Implement > QA Review)',
                 true, false, 4, :steps, NOW(), NOW())
            ON CONFLICT (name) DO NOTHING
            """
        ).bindparams(steps=json.dumps(_qa_workflow_steps))
    )

    # Workflow 1 원복
    _default_steps_original = _DEFAULT_WORKFLOW_STEPS[:3]  # QA 제외
    op.execute(
        sa.text(
            """
            UPDATE workflow_definitions
            SET steps = :steps,
                description = '안정성: 복잡한 구조 변경 (Research > Plan > Implement)',
                updated_at = NOW()
            WHERE id = 'default-workflow' OR name = 'Workflow 1'
            """
        ).bindparams(steps=json.dumps(_default_steps_original))
    )

    # Workflow 2 원복
    _wf2_steps_original = _WF2_STEPS[:2]  # QA 제외
    op.execute(
        sa.text(
            """
            UPDATE workflow_definitions
            SET steps = :steps,
                description = '속도: 단순 버그/기능 (Research > Implement)',
                updated_at = NOW()
            WHERE name = 'Workflow 2'
            """
        ).bindparams(steps=json.dumps(_wf2_steps_original))
    )
