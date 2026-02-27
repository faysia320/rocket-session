# 작업 이력: Workspace Insights + QA Workflow + UI 개선

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Workspace Insights 지식 베이스 시스템을 구축하고, QA Workflow 체크리스트 검증 기능을 추가하며, Select/DiffViewer 등의 UI 반응형 레이아웃을 개선했습니다.

## 변경 파일 목록

### Backend

- `backend/app/models/workspace_insight.py` - WorkspaceInsight ORM 모델
- `backend/app/repositories/workspace_insight_repo.py` - 인사이트 CRUD 리포지토리
- `backend/app/schemas/workspace_insight.py` - 인사이트 Pydantic 스키마
- `backend/app/schemas/context.py` - 컨텍스트 빌더 응답 스키마
- `backend/app/services/insight_service.py` - 인사이트 서비스 (CRUD + 자동 추출)
- `backend/app/services/context_builder_service.py` - 컨텍스트 통합 빌더 서비스
- `backend/app/api/v1/endpoints/insights.py` - 인사이트 REST API 엔드포인트
- `backend/app/api/v1/endpoints/context.py` - 컨텍스트 제안 REST API 엔드포인트
- `backend/app/api/v1/api.py` - insights, context 라우터 등록
- `backend/app/api/dependencies.py` - InsightService, ContextBuilderService 의존성 등록
- `backend/app/models/__init__.py` - WorkspaceInsight 모델 export
- `backend/app/models/event_types.py` - WORKFLOW_QA_FAILED 이벤트 추가
- `backend/app/services/claude_runner.py` - QA 체크리스트 파싱 + 인사이트 자동 추출
- `backend/app/services/workflow_service.py` - parse_qa_checklist 파싱 순서 수정
- `backend/migrations/versions/20260228_0025_add_workspace_insights.py` - 인사이트 테이블 마이그레이션
- `backend/migrations/versions/20260228_0026_add_qa_workflow_definitions.py` - QA 워크플로우 정의

### Frontend

- `frontend/src/types/knowledge.ts` - InsightCategory, WorkspaceInsightInfo 등 타입
- `frontend/src/types/workflow.ts` - QAStatus, QAChecklistItem, QAChecklistResult 타입
- `frontend/src/types/ws-events.ts` - WsInsightExtractedEvent, WsWorkflowQAFailedEvent
- `frontend/src/types/index.ts` - 신규 타입 re-export
- `frontend/src/lib/api/insights.api.ts` - 인사이트 API 클라이언트
- `frontend/src/lib/api/context.api.ts` - 컨텍스트 제안 API 클라이언트
- `frontend/src/features/knowledge/` - Knowledge Base UI (카드, 다이얼로그, 패널)
- `frontend/src/features/context/` - 컨텍스트 제안 패널 (체크박스 선택)
- `frontend/src/features/workflow/components/QAChecklistCard.tsx` - QA 결과 시각화
- `frontend/src/routes/knowledge-base.tsx` - /knowledge-base 라우트
- `frontend/src/features/session/components/Sidebar.tsx` - Knowledge Base 네비게이션 버튼
- `frontend/src/routeTree.gen.ts` - knowledge-base 라우트 등록
- `frontend/src/components/ui/select.tsx` - 드롭다운 너비 정규화, truncate
- `frontend/src/features/files/components/DiffViewer.tsx` - max-h + overflow 개선
- `frontend/src/features/git-monitor/components/GitCommitItem.tsx` - hideHeaders 적용
- `frontend/src/features/git-monitor/components/GitStatusFileList.tsx` - overflow 이중 스크롤 방지
- `frontend/src/features/workflow/components/WorkflowDefinitionSelector.tsx` - 스타일 통일

## 상세 변경 내용

### 1. Workspace Insights 지식 베이스 시스템

- 세션 완료 시 인사이트를 자동 추출하여 workspace_insights 테이블에 저장
- 카테고리별 분류: pattern, gotcha, decision, file_map, dependency
- Knowledge Base UI에서 인사이트 CRUD, 카테고리 필터링 제공
- 컨텍스트 빌더가 인사이트 + 최근 세션 + 파일 제안을 통합하여 프롬프트 컨텍스트 생성

### 2. QA Workflow 체크리스트 검증

- 4단계 워크플로우 정의 추가 (Research → Plan → Implement → QA)
- QA phase 완료 시 아티팩트에서 체크리스트 파싱 (마크다운 체크박스 우선)
- FAIL 항목 존재 시 WORKFLOW_QA_FAILED 이벤트 브로드캐스트
- QAChecklistCard로 pass/fail/warn 시각화

### 3. UI/UX 반응형 개선

- Select 드롭다운 너비를 trigger 기준으로 정규화
- DiffViewer에 max-h-[600px] + overflow-auto 추가
- GitMonitor 컴포넌트에서 이중 스크롤 방지 (overflow-hidden + DiffViewer 자체 스크롤)
- WorkflowDefinitionSelector 스타일 통일

## 관련 커밋

- Design: Improve Select, DiffViewer 반응형 레이아웃
- Feat: Add Workspace Insights 지식 베이스 시스템
- Feat: Add QA Workflow 체크리스트 검증

## 테스트 방법

1. `/knowledge-base` 페이지 접속하여 인사이트 CRUD 동작 확인
2. 워크플로우 실행 후 QA phase에서 체크리스트 파싱 결과 확인
3. Select 드롭다운이 trigger 너비에 맞춰 렌더링되는지 확인
4. DiffViewer가 600px 이상 콘텐츠에서 스크롤 동작하는지 확인
