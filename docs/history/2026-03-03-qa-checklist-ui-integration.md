# 작업 이력: QA 체크리스트 UI 통합

- **날짜**: 2026-03-03
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우 QA 단계에서 Claude가 생성한 PASS/FAIL/WARN 체크리스트를 구조화된 UI로 표시하도록 통합했습니다.
백엔드 파싱 로직과 프론트엔드 컴포넌트(`QAChecklistCard`)는 이미 구현되어 있었지만 UI에 연결되지 않은 상태였으며,
이번 작업에서 3개 파일을 수정하여 실제 UI에 wire-up 했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/workflow/utils/parseQaChecklist.ts` - 로컬 타입 정의 제거, `@/types/workflow` 타입으로 통일
- `frontend/src/features/workflow/components/WorkflowPhaseCard.tsx` - QA phase일 때 체크리스트 카드 렌더링
- `frontend/src/features/workflow/components/ArtifactViewer.tsx` - QA 아티팩트 마크다운 위에 체크리스트 요약 표시
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - `workflow_qa_failed` WS 이벤트 → toast 경고 알림

## 상세 변경 내용

### 1. parseQaChecklist.ts 타입 통일

- 로컬 인터페이스 `QaChecklistItem`, `QaChecklistResult` 제거
- `@/types/workflow`의 `QAChecklistItem`, `QAChecklistResult`를 import하여 통일
- 파싱 로직(2패턴 정규식 + 폴백)은 변경 없음

### 2. WorkflowPhaseCard QA 체크리스트 통합

- QA phase 감지 (`message.workflow_phase === "qa"`)
- `useMemo`로 `parseQaChecklist` 결과 캐싱
- 기본 상태: `QAChecklistCard` 요약 표시
- 펼침(expand) 시: 체크리스트 카드 + 원문 마크다운 함께 표시
- QA가 아닌 phase에서는 기존 로직 완전 유지

### 3. ArtifactViewer QA 체크리스트 요약

- QA 아티팩트(`artifact.phase === "qa"`) 감지
- markdown viewMode에서 `QAChecklistCard` + `Separator` 삽입 (마크다운 위)
- source/edit 모드에서는 카드 미표시

### 4. useClaudeSocket WS 이벤트 핸들링

- `workflow_qa_failed` case 핸들러 추가
- FAIL/WARN 카운트 추출 → `toast.warning` 알림 (8초 지속)
- `workflowDataChangedRef` 콜백 호출 (아티팩트 캐시 무효화)

## 테스트 결과

| 검증 항목 | 결과 |
|-----------|------|
| `pnpm build` | ✅ 성공 |
| `pnpm test` (151개) | ✅ 전체 통과 |
| `uv run pytest` (404개) | ✅ 전체 통과 |

## 비고

- 백엔드 변경 없음, DB 변경 없음
- 기존 `QAChecklistCard` 컴포넌트와 `parseQaChecklist` 유틸 100% 재사용
- `PhaseApprovalBar`의 기존 QA FAIL 경고 AlertDialog는 그대로 유지
