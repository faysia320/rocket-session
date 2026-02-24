# 작업 이력: 워크플로우 새로고침 상태 복구 + 실행 중 비활성화

- **날짜**: 2026-02-24
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우 `awaiting_approval` 상태에서 새로고침 시 아티팩트 뷰어가 닫혀 교착 상태에 빠지는 버그를 수정했습니다. 또한 실행 중일 때 승인/수정 요청 버튼을 비활성화하는 `disabled` prop을 전파했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/workflow/hooks/useWorkflowActions.ts` - 자동 열기 로직 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - 워크플로우 상태 전달 + disabled 전파
- `frontend/src/features/chat/components/MessageBubble.tsx` - disabled prop 전달
- `frontend/src/features/workflow/components/ArtifactViewer.tsx` - disabled prop 수신
- `frontend/src/features/workflow/components/WorkflowPhaseCard.tsx` - disabled prop으로 버튼 비활성화

## 상세 변경 내용

### 1. 새로고침 후 아티팩트 뷰어 자동 열기

- `useWorkflowActions`에 `workflowPhase`/`workflowPhaseStatus` 파라미터 추가
- `awaiting_approval` 상태 감지 시 해당 단계의 최신 아티팩트를 자동으로 열기
- `autoOpenedKeyRef`로 세션+단계+상태 조합별 1회만 자동 열기 (사용자가 닫은 후 재실행 방지)
- API 실패 시 조용히 무시 (수동 열기 가능)

### 2. 실행 중 승인 버튼 비활성화

- `disabled` prop을 ChatPanel → MessageBubble → WorkflowPhaseCard로 전파
- ArtifactViewer에도 `disabled` prop 추가
- 세션이 running 상태일 때 승인/수정 요청 버튼 비활성화

## 테스트 방법

1. 워크플로우 Plan 단계에서 awaiting_approval 상태 진입
2. 페이지 새로고침 → 아티팩트 뷰어가 자동으로 열리는지 확인
3. 뷰어를 수동으로 닫으면 다시 자동으로 열리지 않는지 확인
4. 실행 중일 때 승인/수정 요청 버튼이 비활성화되는지 확인
