# 작업 이력: 워크플로우 Plan 잔존 코드 제거 + QA 완료 UX 개선

- **날짜**: 2026-03-10
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우 3단계 개편(Research-Implement-QA) 후 남아있던 Plan 단계 잔존 코드를 제거하고,
QA 완료 시 "추가 수정 요청"(QA→Implement→QA 루프) + "완료"(Chat Input 잠금) UX를 구현했습니다.

## 변경 파일 목록

### Backend

- `backend/app/models/session_artifact.py` — docstring에서 plan 참조 제거
- `backend/app/schemas/workflow.py` — `RequestRevisionRequest`에 `target_phase` 필드 추가
- `backend/app/services/workflow_service.py` — `request_revision()`에 `target_phase` 지원, `build_revision_context()`에 `source_phase` 지원 및 Implement 실행 지침 포함
- `backend/app/api/v1/endpoints/workflow.py` — `request_revision` 엔드포인트에서 `target_phase` 전달 및 자동 실행 조건 확장

### Frontend

- `frontend/src/features/chat/components/ActivityStatusBar.tsx` — plan 항목 삭제, 주석 텍스트 단순화
- `frontend/src/features/analytics/components/SessionPhaseChart.tsx` — plan 라벨 삭제
- `frontend/src/features/analytics/components/PhaseTokenBreakdown.tsx` — plan 라벨 삭제
- `frontend/src/types/workflow.ts` — `RequestRevisionRequest`에 `target_phase` 필드 추가
- `frontend/src/features/workflow/hooks/useWorkflowActions.ts` — `targetPhase` 파라미터 지원, `/git-commit` 자동 실행 제거, `sendPrompt` 의존성 제거
- `frontend/src/features/workflow/components/PhaseApprovalBar.tsx` — "커밋 요청"→"완료", "수정 요청"→"추가 수정 요청"(마지막 phase), `target_phase="implement"` 전달
- `frontend/src/features/chat/components/ChatPanel.tsx` — `chatDisabledByWorkflow` 추가 (completed 상태에서도 Chat Input 잠금)

## 상세 변경 내용

### 1. Plan 잔존 코드 제거

4단계→3단계 개편 후 남아있던 `plan` 관련 코드를 프론트엔드 4파일 + 백엔드 1파일에서 제거했습니다.

### 2. QA→Implement 수정 루프

QA 완료 후 "추가 수정 요청" 클릭 시:
1. `target_phase="implement"`로 `request_revision` API 호출
2. 백엔드에서 workflow_phase를 implement로 전환
3. QA 아티팩트를 "검토 결과"로 포함한 revision context 구성 (Implement 실행 지침 포함)
4. Implement 자동 실행 → 완료 시 자동 승인(review_required=False) → QA 자동 체이닝
5. QA 완료 → 다시 "추가 수정 요청" 또는 "완료" 선택

### 3. 완료 잠금

QA에서 "완료" 클릭 시 workflow_phase_status가 "completed"로 변경되고,
ChatPanel에서 `chatDisabledByWorkflow` 변수가 Chat Input을 비활성화합니다.

### 4. build_revision_context 실행 지침 보강

QA→Implement 복귀 시 Implement prompt_template이 적용되지 않는 문제를 해결하기 위해,
`build_revision_context`에 논스톱 실행, 자가 수정, 최종 리포트 지침을 직접 포함했습니다.

## 테스트 방법

1. 워크플로우 시작 (Research → Implement → QA)
2. QA 완료 후 "추가 수정 요청" 클릭 → Implement로 되돌아감 확인
3. Implement 자동 완료 → QA 자동 실행 확인
4. QA 다시 완료 → "완료" 클릭 → Chat Input 잠금 확인

## 비고

- Backend 테스트 46개 모두 통과 (`uv run pytest tests/test_workflow_service.py`)
- Frontend 빌드 성공 (`pnpm build`)
