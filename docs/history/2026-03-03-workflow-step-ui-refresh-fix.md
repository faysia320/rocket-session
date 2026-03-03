# 작업 이력: 워크플로우 변경 시 Step UI 즉시 갱신 버그 수정

- **날짜**: 2026-03-03
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

채팅 화면의 WorkflowProgressBar에서 워크플로우를 변경했을 때, step 버튼 목록이 즉시 갱신되지 않던 버그를 수정했습니다. 근본 원인은 TanStack Query 캐시 무효화에 사용한 쿼리 키가 실제 쿼리 키와 불일치했기 때문입니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/chat/components/ChatPanel.tsx` - 3곳의 쿼리 키 수정 + status 무효화 추가

## 상세 변경 내용

### 1. 쿼리 키 불일치 수정 (버그 #1, #2)

- `onWorkflowChanged` 콜백 (L546)과 `visibilitychange` 핸들러 (L280)에서 사용하던 `["workflow-status", sessionId]` (2요소 배열)를 올바른 `workflowKeys.status(sessionId)` → `["workflow", "status", sessionId]` (3요소 배열)로 교체
- 이 두 키는 완전히 다른 키이므로 `invalidateQueries`가 빈 타겟을 지정하고 있었음

### 2. workflow_changed WS 이벤트 핸들러 보완 (버그 #3)

- `workflowDataChangedRef` 콜백의 `workflow_changed` 분기에 `workflowKeys.status(sessionId)` 무효화 추가
- 기존에는 `sessionKeys.detail`과 `workflowKeys.artifacts`만 무효화하고 `workflowKeys.status`는 누락되어 있었음

## 관련 커밋

- (이 문서와 함께 커밋 예정)

## 테스트 방법

1. 채팅 세션 생성 → WorkflowProgressBar 확인
2. ⚙ 클릭 → 다른 워크플로우 선택
3. step 버튼 목록이 새 워크플로우의 단계로 **즉시** 바뀌는지 확인
4. 탭 전환 테스트: 다른 탭으로 갔다가 돌아올 때 step이 최신 상태인지 확인
