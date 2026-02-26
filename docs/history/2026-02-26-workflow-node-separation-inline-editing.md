# 작업 이력: 워크플로우 노드 분리 + 인라인 편집

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우 단계를 구성하는 Node(Research, Plan, Implement 등)를 독립 엔티티로 분리하고,
워크플로우 정의 편집을 모달에서 인라인 편집 방식으로 전환했습니다.

### 핵심 변경

1. **Node/Definition 분리**: 기존 `WorkflowDefinition.steps` JSONB에 인라인으로 저장되던 노드 속성(name, label, icon, prompt_template, constraints)을 별도 `workflow_nodes` 테이블로 분리
2. **ResolvedWorkflowStep**: API 응답에서 Node 정보와 Step 설정을 결합한 스키마 도입 → 실행 엔진 변경 불필요
3. **인라인 편집**: 모달 기반 편집(`WorkflowDefinitionFormDialog`)을 제거하고, Detail 패널 내 읽기/편집 모드 토글 방식으로 전환
4. **Node 관리 페이지**: 독립적인 Node CRUD 페이지 + 네비게이션 추가

## 변경 파일 목록

### Backend - 신규

- `backend/app/models/workflow_node.py` - WorkflowNode ORM 모델
- `backend/app/schemas/workflow_node.py` - Node CRUD Pydantic 스키마
- `backend/app/repositories/workflow_node_repo.py` - Node 레포지토리 (bulk query 포함)
- `backend/app/services/workflow_node_service.py` - Node CRUD 서비스 (삭제 참조 보호)
- `backend/app/api/v1/endpoints/workflow_nodes.py` - Node REST 엔드포인트 5개
- `backend/migrations/versions/20260226_0019_add_workflow_nodes.py` - 마이그레이션 (테이블 생성 + 기존 데이터 분리)

### Backend - 수정

- `backend/app/models/__init__.py` - WorkflowNode import 추가
- `backend/app/repositories/__init__.py` - WorkflowNodeRepository import 추가
- `backend/app/api/v1/api.py` - workflow_nodes 라우터 등록
- `backend/app/api/dependencies.py` - workflow_node_service 레지스트리 등록
- `backend/app/schemas/workflow_definition.py` - WorkflowStepConfig → node_id 참조, ResolvedWorkflowStep 추가, Export에 nodes 포함
- `backend/app/services/workflow_definition_service.py` - _entity_to_info에 node_map 패턴, export/import 노드 포함
- `backend/app/api/v1/endpoints/workflow_definitions.py` - import에 nodes_data 전달
- `backend/app/services/workflow_service.py` - WorkflowStepConfig → ResolvedWorkflowStep 타입 변경

### Frontend - 신규

- `frontend/src/lib/api/workflowNode.api.ts` - Node API 클라이언트
- `frontend/src/features/workflow/hooks/useWorkflowNodes.ts` - Node React Query hooks
- `frontend/src/routes/nodes.tsx` - /nodes 라우트
- `frontend/src/features/workflow/components/WorkflowNodesPage.tsx` - Node 관리 메인 페이지
- `frontend/src/features/workflow/components/WorkflowNodeList.tsx` - Node 사이드바 리스트
- `frontend/src/features/workflow/components/WorkflowNodeDetail.tsx` - Node 상세/편집 패널

### Frontend - 수정

- `frontend/src/types/workflow.ts` - WorkflowNodeInfo, WorkflowStepConfig(node_id ref), ResolvedWorkflowStep 추가
- `frontend/src/features/layout/components/GlobalTopBar.tsx` - Nodes 네비게이션 추가
- `frontend/src/features/workflow/components/WorkflowStepEditor.tsx` - 노드 선택 드롭다운으로 리팩토링
- `frontend/src/features/workflow/components/WorkflowDefinitionDetail.tsx` - 읽기/편집 모드 토글 인라인 편집
- `frontend/src/features/workflow/components/WorkflowDefinitionsPage.tsx` - 모달 제거, isCreating 상태 관리
- `frontend/src/features/workflow/components/WorkflowPhaseCard.tsx` - ResolvedWorkflowStep 타입
- `frontend/src/features/workflow/components/WorkflowProgressBar.tsx` - ResolvedWorkflowStep 타입
- `frontend/src/features/chat/components/ChatMessageList.tsx` - ResolvedWorkflowStep 타입
- `frontend/src/features/chat/components/MessageBubble.tsx` - ResolvedWorkflowStep 타입
- `frontend/src/features/workflow/hooks/useWorkflowActions.ts` - ResolvedWorkflowStep 타입

### Frontend - 삭제

- `frontend/src/features/workflow/components/WorkflowDefinitionFormDialog.tsx` - 모달 제거
- `frontend/src/features/workflow/components/WorkflowDefinitionListDialog.tsx` - 미사용 코드 제거

## 상세 변경 내용

### 1. WorkflowNode 독립 엔티티

- `workflow_nodes` 테이블: id, name(unique), label, icon, prompt_template, constraints, is_builtin
- CRUD API: GET/POST/PATCH/DELETE /api/workflow-nodes
- 삭제 시 참조 체크: `workflow_definitions.steps @> [{"node_id": "..."}]` JSONB 쿼리
- 마이그레이션: 기존 steps에서 고유 Node 추출 → `workflow_nodes`에 삽입 → steps를 `{node_id, order_index, auto_advance, review_required}` 형태로 변환

### 2. ResolvedWorkflowStep 패턴

- `WorkflowStepConfig`: DB 저장 형태 (node_id + workflow 설정만)
- `ResolvedWorkflowStep`: API 응답 형태 (Node 속성 + workflow 설정 결합)
- `_entity_to_info(entity, node_map)`: N+1 방지를 위해 벌크 조회된 node_map을 전달
- 실행 엔진(workflow_service, claude_runner 등)은 `.name`, `.label`, `.prompt_template` 등을 그대로 접근 가능

### 3. Export/Import 확장

- Export 시 참조된 Node 데이터도 `nodes` 필드에 포함
- Import 시 Node 이름으로 매칭 → 없으면 자동 생성 → node_id remap

### 4. 인라인 편집

- WorkflowDefinitionDetail: isEditing 상태로 읽기↔편집 모드 토글
- 편집 모드에서 WorkflowStepEditor를 이용해 노드 선택 + 순서/설정 편집
- WorkflowDefinitionFormDialog 완전 제거

## 테스트 방법

1. DB 마이그레이션 실행: `alembic upgrade head`
2. /nodes 페이지에서 노드 생성/수정/삭제 확인
3. /workflows 페이지에서 정의 생성 시 노드 선택 드롭다운 확인
4. 기존 세션의 워크플로우 실행이 정상 동작하는지 확인

## 비고

- 하위 호환성 불필요 (사용자 결정: "지금부터 개발하는게 기준")
- Export format version은 1 유지 (새 형식이 표준)
