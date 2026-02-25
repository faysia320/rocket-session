# 작업 이력: 승인 버튼 클릭 시 아티팩트 Drawer 자동 닫기

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Plan 모드의 계획검토 UI(ArtifactViewer Drawer)에서 "승인 → 구현 시작" 버튼 클릭 시 Drawer가 자동으로 닫히지 않던 문제를 수정했습니다. 기존 "수정 요청" 버튼과 동일한 패턴을 적용했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/workflow/hooks/useWorkflowActions.ts` - `handleAdvancePhase` 함수에 drawer 닫기 로직 추가

## 상세 변경 내용

### 1. handleAdvancePhase에 drawer 자동 닫기 추가

- `handleAdvancePhase` 함수의 query invalidation 이후에 `setArtifactViewerOpen(false)`와 `setViewingArtifactId(null)` 호출 추가
- `handleRequestRevision` (line 106-107)에서 이미 사용하는 동일한 패턴
- 승인 API 호출 성공 후 toast 표시 → query invalidation → drawer 닫기 순서로 동작

## 테스트 방법

1. Plan 모드에서 계획 검토 Drawer를 열기
2. "승인 → 구현 시작" 버튼 클릭
3. Drawer가 자동으로 닫히는지 확인
4. toast 메시지가 정상 표시되는지 확인
5. "수정 요청" 기능이 기존과 동일하게 동작하는지 확인
