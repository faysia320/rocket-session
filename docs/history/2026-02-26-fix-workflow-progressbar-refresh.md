# 작업 이력: 워크플로우 완료 후 새로고침 시 ProgressBar 사라지는 버그 수정

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

마지막 워크플로우 단계(implement) 승인 후 페이지 새로고침 시 WorkflowProgressBar가 사라지는 버그를 수정했습니다.
`WorkflowPhaseStatus` Pydantic Literal 타입에 `"completed"` 값이 누락되어 REST API가 500 에러를 반환하는 것이 원인이었습니다.

## 변경 파일 목록

### Backend

- `backend/app/schemas/workflow.py` - `WorkflowPhaseStatus` Literal에 `"completed"` 추가

## 상세 변경 내용

### 1. `WorkflowPhaseStatus` Literal 타입 수정

- `approve_phase()`에서 마지막 단계 승인 시 DB에 `workflow_phase_status = "completed"`를 저장
- 그러나 `WorkflowStatusResponse` 스키마의 `WorkflowPhaseStatus` Literal에 `"completed"`가 없어 Pydantic 검증 실패 → 500 에러
- WebSocket의 `SessionInfo`는 `Optional[str]`이라 영향 없었으므로, 새로고침 전에는 정상 작동
- 새로고침 시에만 REST API `/workflow/status` 호출이 실패하여 steps 데이터 로드 불가 → 빈 진행바

## 테스트 방법

1. 세션에서 워크플로우를 마지막 단계(implement)까지 진행
2. 마지막 단계 승인
3. 페이지 새로고침
4. WorkflowProgressBar가 모든 단계를 "done" 상태(녹색 체크)로 표시하는지 확인
5. Network 탭에서 `/workflow/status` API가 200을 반환하는지 확인
