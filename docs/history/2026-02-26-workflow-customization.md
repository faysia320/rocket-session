# 작업 이력: 워크플로우 커스터마이징 기능

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

하드코딩된 3단계 워크플로우(Research → Plan → Implement)를 DB 기반의 완전한 커스터마이징 시스템으로 전환.
사용자가 워크플로우 단계를 자유롭게 추가/삭제/수정하고, 프리셋으로 저장/불러오기할 수 있도록 구현.

## 변경 파일 목록

### Backend (신규)

- `backend/migrations/versions/20260225_0017_add_workflow_definitions.py` - workflow_definitions 테이블 생성 + 기본 프리셋 시딩
- `backend/app/models/workflow_definition.py` - WorkflowDefinition ORM 모델
- `backend/app/repositories/workflow_definition_repo.py` - Repository 계층 (CRUD + get_builtin_default)
- `backend/app/schemas/workflow_definition.py` - WorkflowStepConfig, Create/Update/Info/Export 스키마
- `backend/app/services/workflow_definition_service.py` - CRUD 서비스 + export/import + get_or_default
- `backend/app/api/v1/endpoints/workflow_definitions.py` - REST API 엔드포인트 (7개 라우트)

### Backend (수정)

- `backend/app/models/session.py` - workflow_definition_id FK 추가
- `backend/app/models/template.py` - workflow_definition_id FK 추가
- `backend/app/schemas/session.py` - workflow_definition_id 필드 추가
- `backend/app/schemas/template.py` - workflow_definition_id 필드 추가
- `backend/app/schemas/workflow.py` - WorkflowPhase를 str로 변경, StartWorkflowRequest 확장
- `backend/app/api/dependencies.py` - WorkflowDefinitionService 등록
- `backend/app/api/v1/api.py` - workflow_definitions 라우터 등록
- `backend/app/services/workflow_service.py` - Definition 기반 동적 단계 로딩으로 전면 리팩터링
- `backend/app/services/claude_runner.py` - 제네릭 권한 분기 + auto-chain 핸들러
- `backend/app/api/v1/endpoints/workflow.py` - 동적 단계 처리
- `backend/app/api/v1/endpoints/ws.py` - Definition 로딩 + step config 전달

### Frontend (신규)

- `frontend/src/lib/api/workflowDefinition.api.ts` - API 클라이언트
- `frontend/src/features/workflow/hooks/useWorkflowDefinitions.ts` - React Query 훅 (6개)
- `frontend/src/features/workflow/components/WorkflowDefinitionSelector.tsx` - 정의 선택 드롭다운
- `frontend/src/features/workflow/components/WorkflowStepEditor.tsx` - 단계 편집기 (접이식 카드)
- `frontend/src/features/workflow/components/WorkflowDefinitionFormDialog.tsx` - 생성/편집 다이얼로그
- `frontend/src/features/workflow/components/WorkflowDefinitionListDialog.tsx` - 목록 관리 다이얼로그

### Frontend (수정)

- `frontend/src/types/workflow.ts` - 동적 타입 체계로 전환
- `frontend/src/features/workflow/components/WorkflowProgressBar.tsx` - 동적 steps prop 기반으로 전환
- `frontend/src/features/workflow/components/WorkflowPhaseCard.tsx` - stepConfig 기반 동적 렌더링
- `frontend/src/features/chat/components/MessageBubble.tsx` - review_required 기반 동적 판단
- `frontend/src/features/chat/components/ChatMessageList.tsx` - workflowSteps 전달
- `frontend/src/features/chat/components/ChatPanel.tsx` - useWorkflowStatus + workflowSteps 연결
- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - 하드코딩 phase명 제거
- `frontend/src/features/workflow/hooks/useWorkflowActions.ts` - 동적 라벨 해석
- `frontend/src/features/session/components/SessionSetupPanel.tsx` - WorkflowDefinitionSelector 통합

## 상세 변경 내용

### 1. DB + Backend CRUD (Phase 1)

- `workflow_definitions` 테이블: id, name, description, is_builtin, steps(JSONB), created_at, updated_at
- 기본 프리셋 "Default Workflow" (is_builtin=true) 시딩: research → plan → implement 3단계
- sessions, session_templates에 workflow_definition_id FK 추가
- 완전한 CRUD API: 목록, 생성, 조회, 수정, 삭제, export(JSON), import 지원
- get_or_default: definition_id 없으면 builtin default 반환, DB에도 없으면 하드코딩 fallback

### 2. WorkflowService 리팩터링 (Phase 2)

- `PHASE_ORDER = ["research", "plan", "implement"]` 하드코딩 제거
- Definition에서 동적 단계 목록 로딩: `_get_steps()`, `_get_steps_from_db()`
- `start_workflow()`: workflow_definition_id, start_from_step 지원 (skip_research/skip_plan 하위 호환)
- `build_phase_context()`: step.prompt_template.format()으로 {user_prompt}, {previous_artifact} 변수 치환
- `get_next_phase()`, `approve_phase()`, `reset_workflow()` 모두 동적 처리

### 3. ClaudeRunner + WS 리팩터링 (Phase 3)

- `_build_command()`: step constraints 기반 권한 분기 (readonly→plan mode, full→pass, else→custom tools)
- `run()` finally 블록: 150줄+ 3단계 if/elif → 단일 제네릭 핸들러
  - `auto_advance` + `review_required` 플래그로 동작 결정
  - next_phase 유무로 자동 체이닝/완료 판단
- WS 엔드포인트: definition steps 로딩, step config를 runner에 전달

### 4. Frontend 동적화 (Phase 4)

- `WorkflowPhase = string` (리터럴 유니온 제거)
- WorkflowProgressBar: steps prop으로 동적 렌더링, ICON_MAP으로 아이콘 해석
- WorkflowPhaseCard: stepConfig.review_required로 승인 버튼 표시 결정
- claudeSocketReducer: 하드코딩된 "implement", "research" 문자열 제거
- 관리 UI: Selector, StepEditor, FormDialog, ListDialog 신규 컴포넌트

### 5. WorkflowStepConfig 구조

```json
{
  "name": "research",
  "label": "리서치",
  "icon": "Search",
  "prompt_template": "You are a research agent... {user_prompt} {previous_artifact}",
  "constraints": "readonly",
  "auto_advance": true,
  "review_required": false,
  "order_index": 0
}
```

## 테스트 방법

1. `alembic upgrade head`로 마이그레이션 적용
2. 워크플로우 모드로 세션 생성 시 기본 프리셋 자동 적용 확인
3. 워크플로우 정의 관리 UI에서 새 프리셋 생성/편집/삭제 테스트
4. 커스텀 단계 수의 워크플로우 실행 (2단계, 4단계 등)
5. 단계별 auto_advance, review_required 동작 확인
6. export/import JSON 파일로 프리셋 공유 테스트

## 비고

- 하위 호환: 기존 skip_research/skip_plan 파라미터 유지
- Fallback: DB에 기본 프리셋 없어도 하드코딩 fallback으로 동작 보장
- 템플릿 변수: {user_prompt}는 사용자 입력, {previous_artifact}는 이전 단계 승인된 결과물 주입
