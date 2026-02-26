# 작업 이력: 시스템 워크플로우 보호 기능

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

기존 Workflow 1~3을 시스템 워크플로우(기본 제공)로 승격시켜 삭제 불가, 이름 변경 불가, 상단 고정 정렬 기능을 구현했습니다. 프롬프트 수정은 허용됩니다.

## 변경 파일 목록

### Backend

- `backend/migrations/versions/20260226_0024_add_system_workflows.py` - sort_order 컬럼 추가 및 시스템 워크플로우 시드 데이터
- `backend/app/models/workflow_definition.py` - sort_order 컬럼 ORM 매핑 추가
- `backend/app/schemas/workflow_definition.py` - is_builtin, sort_order 응답 필드 추가
- `backend/app/repositories/workflow_definition_repo.py` - 정렬 로직 변경 (builtin 우선 + sort_order)
- `backend/app/services/workflow_definition_service.py` - 삭제/이름변경 보호 로직, 매핑 업데이트
- `backend/app/api/v1/endpoints/workflow_definitions.py` - ValueError → 403 에러 핸들링

### Frontend

- `frontend/src/types/workflow.ts` - is_builtin, sort_order 타입 추가
- `frontend/src/features/workflow/components/WorkflowDefinitionsPage.tsx` - 정렬 로직 및 삭제 가드
- `frontend/src/features/workflow/components/WorkflowDefinitionDetail.tsx` - 삭제 버튼 숨김, 이름 disabled, System 뱃지
- `frontend/src/features/workflow/components/WorkflowDefinitionList.tsx` - System 뱃지
- `frontend/src/features/workflow/components/WorkflowDefinitionSelector.tsx` - 정렬 로직

## 상세 변경 내용

### 1. DB Migration (0024)

- `sort_order` INTEGER 컬럼 추가 (server_default=0)
- Workflow 1: 기존 `default-workflow` 행에 sort_order=1 UPDATE
- Workflow 2, 3: UPSERT 패턴으로 기존 DB와 신규 DB 모두 대응
- 기존 DB에 이미 존재하는 워크플로우는 is_builtin=true, sort_order만 갱신

### 2. Backend 보호 로직

- 시스템 워크플로우 삭제 시도 → ValueError → HTTP 403
- 시스템 워크플로우 이름 변경 시도 → ValueError → HTTP 403
- 프롬프트(steps), 설명(description) 수정은 허용

### 3. 정렬 로직

- Backend: is_builtin DESC → sort_order ASC → is_default DESC → updated_at DESC
- Frontend: 동일한 정렬 로직을 WorkflowDefinitionsPage, WorkflowDefinitionSelector에 적용

### 4. Frontend UI

- System 뱃지: 시스템 워크플로우에 파란색 "System" 뱃지 표시
- 삭제 버튼: 시스템 워크플로우 선택 시 숨김 처리
- 이름 입력: 시스템 워크플로우 편집 시 disabled 처리

## 테스트 방법

1. Workflows 메뉴에서 Workflow 1, 2, 3이 상단에 고정 정렬되는지 확인
2. 시스템 워크플로우 선택 시 삭제 버튼이 표시되지 않는지 확인
3. 시스템 워크플로우의 프롬프트 수정이 가능한지 확인
4. 시스템 워크플로우 이름 변경이 불가한지 확인 (disabled)
5. API: DELETE /workflow-definitions/{system-id} → 403 응답 확인
