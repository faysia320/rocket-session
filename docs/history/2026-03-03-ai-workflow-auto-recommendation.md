# 작업 이력: AI 기반 워크플로우 자동 추천 시스템

- **날짜**: 2026-03-03
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

세션 생성 시 사용자가 수동으로 워크플로우를 선택하는 방식을 **AI가 첫 메시지를 분석하여 자동으로 적합한 워크플로우를 선택**하도록 변경했습니다. 기존 Workflow 4(QA 전용)를 삭제하고 QA 단계를 Workflow 1/2에 통합했으며, 커스텀 워크플로우도 AI 추천으로 자동 선택 가능합니다.

## 변경 파일 목록

### Backend

- `backend/app/services/workflow_recommender_service.py` - (신규) Claude CLI subprocess 기반 AI 워크플로우 추천 서비스
- `backend/app/api/dependencies.py` - WorkflowRecommenderService DI 등록
- `backend/app/api/v1/endpoints/ws.py` - 첫 메시지 AI 추천 로직 + workflow_changed 브로드캐스트
- `backend/migrations/versions/20260302_0028_modify_workflow_qa.py` - (신규) Workflow 1/2에 QA 단계 추가, Workflow 4 삭제
- `backend/tests/test_workflow_gate.py` - AI 추천 서비스 mock 추가

### Frontend

- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - workflow_changed 이벤트 처리 + QA 라벨 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - 캐시 무효화 로직 + WorkflowProgressBar 새 props
- `frontend/src/features/chat/components/ActivityStatusBar.tsx` - 상태바 클릭으로 아티팩트 뷰어 열기
- `frontend/src/features/workflow/components/WorkflowProgressBar.tsx` - 수동 워크플로우 변경 UI (Settings2 아이콘 + Popover)
- `frontend/src/features/session/components/SessionSetupPanel.tsx` - 워크플로우 수동 선택 UI 제거
- `frontend/src/features/git-monitor/components/CommitDialog.tsx` - 워크플로우 수동 선택 UI 제거

## 상세 변경 내용

### 1. WorkflowRecommenderService (Backend)

- Claude CLI subprocess(`claude -p ... --output-format json`)로 사용자 첫 메시지를 분석
- 모든 워크플로우 정의(커스텀 포함)의 description과 step_count를 기준으로 판단
- 10초 타임아웃, CancelledError 시 subprocess kill 처리
- `recommend(prompt, definitions)` → workflow_definition_id 또는 None 반환

### 2. ws.py 첫 메시지 AI 추천 로직

- `_handle_prompt()`에서 `workflow_original_prompt`가 NULL인 경우(첫 메시지) AI 추천 실행
- 추천 결과가 현재 정의와 다르면 `start_workflow()`로 전환 + `update_settings(workflow_original_prompt=prompt)`
- 클라이언트에 `workflow_changed` WebSocket 이벤트 브로드캐스트
- `workflow_original_prompt` 저장으로 이후 메시지에서 AI 추천 재실행 방지

### 3. DB 마이그레이션 (0028)

- Workflow 1(default-workflow): Research → Plan → Implement → **QA** (단계 추가)
- Workflow 2(name 매칭): Research → Implement → **QA** (단계 추가)
- Workflow 4: 삭제 (QA 단계가 Workflow 1/2에 통합됨)
- WHERE 절은 UUID 환경 대응을 위해 `name` 기준 매칭 사용

### 4. Frontend 워크플로우 이벤트 처리

- `useClaudeSocket`: `workflow_changed` 이벤트 수신 → toast 알림 + 캐시 무효화
- `ChatPanel`: `workflowDataChangedRef` 콜백에서 이벤트 유형별 분기 처리
- `ActivityStatusBar`: `onOpenArtifact` prop 추가로 상태바 클릭 시 아티팩트 뷰어 열기

### 5. WorkflowProgressBar 수동 변경 UI

- Settings2 아이콘 + Popover로 워크플로우 수동 변경 가능
- `currentDefinitionId` useEffect 동기화로 AI 추천 변경 반영
- 실행 중(isRunning)일 때 변경 버튼 비활성화

### 6. 세션 생성 UI 정리

- `SessionSetupPanel`: WORKFLOW DEFINITION 섹션 전체 제거
- `CommitDialog`: WorkflowDefinitionSelector 제거, "AI가 적합한 워크플로우를 자동 선택합니다" 안내 추가

## 테스트 방법

1. 새 세션 생성 (워크플로우 선택 UI 없음 확인)
2. 첫 메시지 전송 → AI가 워크플로우 추천 toast 확인
3. WorkflowProgressBar의 ⚙ 아이콘으로 수동 변경 가능 확인
4. `uv run pytest` 전체 통과 확인 (404 passed)
5. `pnpm build` 성공 확인

## 비고

- 모델명 `claude-haiku-4-5-20251001`은 현재 환경에서 작동 중이나, 프로덕션 배포 시 확인 권장
- 마이그레이션 적용: `alembic upgrade head` 필요 (Docker 컨테이너 재시작 시 자동 적용)
