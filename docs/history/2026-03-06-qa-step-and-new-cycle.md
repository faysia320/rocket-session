# 작업 이력: QA 단계 추가 + 워크플로우 새 사이클 시작 기능

- **날짜**: 2026-03-06
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

1. 기본 워크플로우 정의에 QA 단계를 추가하여 4단계 워크플로우(Research → Plan → Implement → QA)를 완성
2. 워크플로우 진입 검증(validation-on-entry) 파이프라인을 Claude Runner에 통합
3. 검증 관련 프론트엔드 이벤트 처리 및 워크스페이스 설정 UI 추가
4. Usage 서비스 안정성 개선 (버전 감지, 에러 로깅)
5. 워크플로우 사이클 완료 후 "이어서 구현" / "새 주제 시작" 기능 추가

## 변경 파일 목록

### Backend

- `backend/app/models/event_types.py` - `WORKFLOW_VALIDATION_FAILED`, `WORKFLOW_VALIDATION_MAX_RETRIES` 이벤트 추가
- `backend/app/services/claude_runner.py` - `_run_entry_validation()` 메서드 + 검증 재시도 카운터 추가
- `backend/app/services/workflow_definition_service.py` - 기본 워크플로우에 QA 단계(order_index=3) 추가
- `backend/app/services/workflow_service.py` - `start_workflow()`에 `workflow_original_prompt=None` 초기화 추가
- `backend/app/api/v1/endpoints/workflow.py` - 승인 시 검증 재시도 카운터 리셋
- `backend/app/services/usage_service.py` - Claude Code 버전 자동 감지, Rate Limit 에러 로깅 개선
- `backend/migrations/versions/20260306_add_run_validation_to_qa_steps.py` - QA steps 마이그레이션
- `backend/tests/test_workflow_definition_service.py` - QA 단계 포함 테스트 갱신
- `backend/tests/test_workflow_service.py` - 4단계 워크플로우 흐름 테스트

### Frontend

- `frontend/src/features/workflow/components/WorkflowProgressBar.tsx` - completed 상태에서 "이어서 구현" / "새 주제" 버튼 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - `handleNewCycle` 콜백 + `useStartWorkflow` 연결
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - 검증 실패/재시도 초과 WS 이벤트 toast 처리
- `frontend/src/features/workspace/components/WorkspaceList.tsx` - 워크스페이스 설정 버튼 추가
- `frontend/src/features/workspace/components/ValidationCommandEditor.tsx` - 검증 명령 편집 컴포넌트 (신규)
- `frontend/src/features/workspace/components/WorkspaceSettingsSheet.tsx` - 워크스페이스 설정 시트 (신규)

## 상세 변경 내용

### 1. QA 단계 추가

- 기본 워크플로우를 3단계(Research/Plan/Implement)에서 4단계(+QA)로 확장
- QA 단계: `constraints="readonly"`, `review_required=True`, `run_validation=True`
- Implement → QA 전환 시 진입 검증 실행

### 2. 진입 검증 파이프라인

- `_run_entry_validation()`: 다음 단계의 `run_validation=True`인 경우 검증 명령 실행
- 검증 실패 시 Implement 단계로 자동 복귀하여 Claude가 수정
- 최대 3회 재시도 후 QA 단계로 강제 진행 (사용자 판단)

### 3. 워크플로우 새 사이클 시작

- 사이클 완료 후 WorkflowProgressBar에 두 버튼 표시
- "이어서 구현": `start_from_step="implement"`로 Implement부터 재시작
- "새 주제": Research부터 전체 사이클 재시작
- `start_workflow()`에서 `workflow_original_prompt=None` 초기화하여 새 프롬프트 저장

### 4. Usage 서비스 개선

- `_detect_claude_code_version()`: 설치된 Claude Code 버전 자동 감지 (lru_cache)
- Rate Limit 에러 시 응답 body 일부를 로깅
- 캐시 워밍업 시 에러 상태도 로깅

## 테스트 방법

1. 워크플로우 4단계 흐름: 세션 생성 → Research → Plan → Implement → QA → 승인
2. 검증 실패: 워크스페이스에 검증 명령 설정 → Implement 완료 후 QA 진입 시 검증 실행 확인
3. 새 사이클: QA 승인 후 "이어서 구현" / "새 주제" 버튼 클릭 → 워크플로우 재시작 확인
