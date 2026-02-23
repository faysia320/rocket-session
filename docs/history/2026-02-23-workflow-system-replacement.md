# 작업 이력: Plan Mode → Workflow 시스템 전면 교체

- **날짜**: 2026-02-23
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

기존 Plan Mode (`normal` / `plan`)를 완전히 제거하고, Boris Tane의 "How I Use Claude Code" 방법론에 기반한 3단계 워크플로우 시스템(Research → Plan → Implement)으로 전면 교체했습니다. 세션 레벨에서 워크플로우를 활성화하면 각 단계별 아티팩트 생성, 인라인 주석(GitHub PR 리뷰 스타일), 승인 게이트를 통해 체계적인 개발 프로세스를 제공합니다.

## 변경 파일 목록

### Backend - 신규 파일

- `backend/app/models/session_artifact.py` - SessionArtifact + ArtifactAnnotation ORM 모델
- `backend/app/repositories/artifact_repo.py` - 아티팩트/주석 Repository
- `backend/app/services/workflow_service.py` - 워크플로우 비즈니스 로직 (단계 전환, 승인, 수정 요청)
- `backend/app/schemas/workflow.py` - 워크플로우 요청/응답 Pydantic 스키마
- `backend/app/api/v1/endpoints/workflow.py` - 워크플로우 API 엔드포인트
- `backend/migrations/versions/20260223_d606eb44b955_replace_mode_with_workflow_system.py` - Alembic 마이그레이션

### Backend - 수정 파일

- `backend/app/models/session.py` - `mode` 컬럼 → `workflow_enabled` + `workflow_phase` + `workflow_phase_status`
- `backend/app/models/global_settings.py` - `mode` → `workflow_enabled`
- `backend/app/models/template.py` - `mode` → `workflow_enabled`
- `backend/app/models/message.py` - `workflow_phase` 컬럼 추가
- `backend/app/models/event_types.py` - `mode_change` 이벤트 → 워크플로우 이벤트 6종 추가
- `backend/app/models/__init__.py` - 새 모델 등록
- `backend/app/schemas/session.py` - mode → workflow 필드 교체
- `backend/app/schemas/settings.py` - mode → workflow_enabled
- `backend/app/schemas/template.py` - mode → workflow_enabled
- `backend/app/services/claude_runner.py` - `--permission-mode plan` 플래그 (research/plan 단계)
- `backend/app/services/session_manager.py` - 워크플로우 상태 관리
- `backend/app/services/settings_service.py` - mode → workflow_enabled
- `backend/app/services/template_service.py` - mode → workflow_enabled
- `backend/app/services/jsonl_watcher.py` - 미사용 mode 참조 제거
- `backend/app/services/search_service.py` - mode → workflow_phase
- `backend/app/api/v1/api.py` - 워크플로우 라우터 등록
- `backend/app/api/v1/endpoints/ws.py` - 워크플로우 WebSocket 이벤트 처리
- `backend/app/api/v1/endpoints/sessions.py` - mode → workflow_enabled
- `backend/app/api/v1/endpoints/settings.py` - mode → workflow_enabled
- `backend/app/api/v1/endpoints/templates.py` - mode → workflow_enabled
- `backend/app/api/dependencies.py` - WorkflowService DI 등록
- 기타 팀 관련 파일 (team_*, permissions 등) - mode 참조 제거

### Frontend - 신규 파일

- `frontend/src/types/workflow.ts` - 워크플로우 전체 타입 정의
- `frontend/src/lib/api/workflow.api.ts` - 워크플로우 API 함수
- `frontend/src/features/workflow/hooks/useWorkflow.ts` - TanStack Query 쿼리/뮤테이션 훅
- `frontend/src/features/workflow/hooks/useWorkflowActions.ts` - 단계 전환 액션 훅
- `frontend/src/features/workflow/components/WorkflowProgressBar.tsx` - 3단계 진행률 바
- `frontend/src/features/workflow/components/WorkflowPhaseCard.tsx` - 단계 결과 카드
- `frontend/src/features/workflow/components/ArtifactViewer.tsx` - 인라인 주석 뷰어 (Sheet)
- `frontend/src/features/workflow/components/ArtifactAnnotationPanel.tsx` - 주석 사이드 패널
- `frontend/src/features/workflow/components/PhaseApprovalBar.tsx` - 승인/수정 요청 바

### Frontend - 수정 파일

- `frontend/src/types/session.ts` - mode → workflow_enabled/phase/phase_status
- `frontend/src/types/message.ts` - planFileContent/mode/planExecuted → workflow_phase/workflowApproved
- `frontend/src/types/settings.ts` - mode → workflow_enabled
- `frontend/src/types/template.ts` - mode → workflow_enabled
- `frontend/src/types/index.ts` - SessionMode 제거, 워크플로우 타입 export 추가
- `frontend/src/lib/api/client.ts` - `put()` 메서드 추가
- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - 전면 재작성 (workflow 상태)
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - mode → workflow 이벤트
- `frontend/src/features/chat/components/ChatPanel.tsx` - 워크플로우 UI 통합
- `frontend/src/features/chat/components/MessageBubble.tsx` - WorkflowPhaseCard 교체
- `frontend/src/features/chat/components/ChatInput.tsx` - mode 토글 버튼 제거
- `frontend/src/features/chat/components/ActivityStatusBar.tsx` - 워크플로우 대기 표시
- `frontend/src/features/chat/utils/chatComputations.ts` - mode → workflow_phase
- `frontend/src/features/command-palette/commands/chat.ts` - 모드 전환 명령 제거
- `frontend/src/features/session/components/SessionSetupPanel.tsx` - 워크플로우 토글 추가
- `frontend/src/features/settings/components/GlobalSettingsDialog.tsx` - mode → workflow 토글
- `frontend/src/features/template/components/TemplateFormDialog.tsx` - mode → workflow 토글
- `frontend/src/features/template/components/TemplateListDialog.tsx` - mode → workflow 뱃지

### Frontend - 삭제 파일

- `frontend/src/features/chat/components/ModeIndicator.tsx` - Plan/Normal 모드 표시기
- `frontend/src/features/chat/components/PlanResultCard.tsx` - Plan 결과 카드
- `frontend/src/features/chat/hooks/usePlanActions.ts` - Plan 액션 훅
- `frontend/src/features/chat/utils/planFileExtractor.ts` - Plan 파일 파서

### Frontend - 테스트 파일

- `frontend/src/features/chat/components/MessageBubble.test.tsx` - 워크플로우 테스트로 갱신
- `frontend/src/features/chat/hooks/claudeSocketReducer.test.ts` - 워크플로우 이벤트 테스트
- `frontend/src/features/chat/hooks/useClaudeSocket.test.ts` - mode 옵션 제거

## 상세 변경 내용

### 1. 워크플로우 데이터 모델

- Session 모델에 `workflow_enabled`, `workflow_phase`, `workflow_phase_status` 필드 추가
- 새로운 `SessionArtifact` 모델: 단계별 생성 문서 (연구 보고서, 계획서 등)
- 새로운 `ArtifactAnnotation` 모델: 아티팩트 인라인 주석 (line_start, line_end, type)
- Alembic 마이그레이션으로 기존 `mode` 컬럼 → 워크플로우 컬럼 변환

### 2. 워크플로우 서비스

- 3단계 순차 진행: research → plan → implement
- 각 단계 완료 시 `awaiting_approval` 상태로 전환
- 승인 시 다음 단계 자동 시작, 수정 요청 시 현재 단계 재실행
- ClaudeRunner에 `--permission-mode plan` 플래그 (research/plan 단계에서 읽기 전용)

### 3. 워크플로우 API

- `POST /api/sessions/{id}/workflow/start` - 워크플로우 시작
- `GET /api/sessions/{id}/workflow/status` - 현재 상태 조회
- `GET/PUT /api/sessions/{id}/workflow/artifacts` - 아티팩트 CRUD
- `POST /api/sessions/{id}/workflow/artifacts/{id}/annotations` - 주석 추가
- `POST /api/sessions/{id}/workflow/approve` - 단계 승인
- `POST /api/sessions/{id}/workflow/request-revision` - 수정 요청

### 4. 프론트엔드 워크플로우 UI

- `WorkflowProgressBar`: Research → Plan → Implement 3단계 진행률 표시
- `WorkflowPhaseCard`: 단계 결과 마크다운 미리보기 + 승인/수정 버튼
- `ArtifactViewer`: GitHub PR 리뷰 스타일 인라인 주석 뷰어 (Sheet)
- `PhaseApprovalBar`: 하단 승인/수정 요청 바

### 5. Plan Mode 완전 제거

- `SessionMode` 타입 삭제, `mode` 상태/토글 버튼/명령 팔레트 명령 제거
- `PlanResultCard`, `ModeIndicator`, `usePlanActions`, `planFileExtractor` 삭제
- 글로벌 설정/템플릿의 Mode 선택 → Workflow 토글로 교체
- 세션 생성 패널에 Workflow Mode 토글 추가

## 검증 결과

- TypeScript 타입 체크: 에러 0건
- Vite 프로덕션 빌드: 성공 (59초, 3214 모듈)
- 백엔드 ruff 린트: 신규 코드 에러 없음

## 비고

- Docker 이미지 재빌드 + 컨테이너 재시작 후 E2E 테스트 필요
- Alembic 마이그레이션 실행 필요 (`alembic upgrade head`)
- 기존 `mode="plan"` 데이터는 마이그레이션에서 `workflow_enabled=false`로 변환
