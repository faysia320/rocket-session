# 작업 이력: Workflow 토글 제거 (항상 workflow 모드)

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

모든 세션이 항상 workflow 모드로 실행되도록 변경했습니다. workflow_enabled 토글/체크박스를 UI에서 완전히 제거하고, 백엔드에서 항상 `workflow_enabled=True`로 설정합니다. DB 컬럼은 마이그레이션 리스크 없이 유지하되, 코드 레벨에서 항상 true로 처리합니다.

## 변경 파일 목록

### Backend

- `backend/app/api/v1/endpoints/sessions.py` - 세션 생성 시 항상 `workflow_enabled=True`
- `backend/app/api/v1/endpoints/settings.py` - 글로벌 설정에서 workflow_enabled 파라미터 제거
- `backend/app/api/v1/endpoints/ws.py` - 비워크플로우 readonly 제한 제거, 조건 단순화
- `backend/app/schemas/session.py` - Create/Update 스키마에서 workflow_enabled 필드 제거
- `backend/app/schemas/settings.py` - 글로벌 설정 스키마에서 workflow_enabled 필드 제거
- `backend/app/services/claude_runner.py` - 비워크플로우 readonly 블록 제거
- `backend/app/services/session_manager.py` - create/fork에서 항상 workflow 활성화, to_info에서 하드코딩
- `backend/app/services/settings_service.py` - get/update에서 workflow_enabled 로직 제거
- `backend/tests/test_api_endpoints.py` - 테스트 assertion 업데이트
- `backend/tests/test_database.py` - 테스트 데이터 업데이트
- `backend/tests/test_workflow_gate.py` - 게이트1을 자동 복구 테스트로 변경, 모킹 추가

### Frontend

- `frontend/src/features/session/components/SessionSetupPanel.tsx` - Switch 토글 제거, WorkflowDefinitionSelector 항상 표시
- `frontend/src/features/settings/components/GlobalSettingsDialog.tsx` - WORKFLOW 체크박스 섹션 제거
- `frontend/src/features/chat/components/ChatPanel.tsx` - handleEnableWorkflow 제거, 항상 WorkflowProgressBar 렌더링
- `frontend/src/features/chat/components/ChatHeader.tsx` - workflowEnabled/onEnableWorkflow props 제거
- `frontend/src/features/chat/components/SessionDropdownMenu.tsx` - "워크플로우 전환" 메뉴 항목 제거
- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - CLEAR_MESSAGES 조건 단순화
- `frontend/src/features/session/hooks/useSessions.ts` - mutation 타입에서 workflow_enabled 제거
- `frontend/src/lib/api/sessions.api.ts` - create options에서 workflow_enabled 제거
- `frontend/src/types/session.ts` - Create/UpdateSessionRequest에서 workflow_enabled 제거
- `frontend/src/types/settings.ts` - GlobalSettings에서 workflow_enabled 제거

## 상세 변경 내용

### 1. Backend: 항상 workflow 모드 적용

- 세션 생성 시 `workflow_enabled=True` 하드코딩, `workflow_phase="research"`, `workflow_phase_status="in_progress"` 자동 설정
- 세션 포크 시에도 동일하게 항상 workflow 활성화
- 비워크플로우 세션의 readonly 제한 (READONLY_TOOLS) 완전 제거
- `to_info()`에서 `workflow_enabled=True` 하드코딩

### 2. Frontend: UI 토글/체크박스 제거

- SessionSetupPanel: "Workflow Mode" Switch 토글 제거, WorkflowDefinitionSelector가 항상 표시
- GlobalSettingsDialog: "워크플로우 모드 기본 활성화" 체크박스 제거
- ChatPanel: "읽기전용 모드" 바 제거, WorkflowProgressBar 항상 렌더링
- SessionDropdownMenu: "워크플로우 전환" 메뉴 항목 제거

### 3. 테스트 업데이트

- `test_api_endpoints.py`: workflow_enabled 기본값 assertion을 True로 변경
- `test_database.py`: 테스트 데이터를 workflow_enabled=True로 변경
- `test_workflow_gate.py`: 게이트1 테스트를 "차단" → "자동 복구" 검증으로 변경, get_workflow_definition_service 모킹 추가

## 테스트 결과

- Backend: 47 passed (기존 깨진 테스트 2개 제외: test_session_manager, test_workflow_service)
- Frontend TypeScript: 통과
- Frontend ESLint: 통과

## 비고

- DB의 `workflow_enabled` 컬럼은 유지 (마이그레이션 리스크 방지)
- `SessionInfo.workflow_enabled` 타입은 WebSocket 하위 호환성을 위해 유지
- `useStartWorkflow` 훅은 다른 곳에서도 사용될 수 있으므로 훅 자체는 삭제하지 않음
