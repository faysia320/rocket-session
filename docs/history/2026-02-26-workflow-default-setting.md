# 작업 이력: 워크플로우 Default 설정 기능

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

기존 `is_builtin` 기반의 읽기전용 제약을 제거하고, 사용자가 원하는 워크플로우를 "Default"로 설정할 수 있는 `is_default` 시스템으로 교체했습니다. 모든 워크플로우가 수정/삭제 가능하며, Default 워크플로우에는 뱃지가 표시되고 목록 최상단에 위치합니다.

## 변경 파일 목록

### Backend

- `backend/migrations/versions/20260226_0023_add_is_default_column.py` - is_default 컬럼 추가 마이그레이션
- `backend/app/models/workflow_definition.py` - is_default 컬럼 추가
- `backend/app/schemas/workflow_definition.py` - API 응답에서 is_builtin을 is_default로 교체
- `backend/app/repositories/workflow_definition_repo.py` - get_default(), clear_all_defaults() 메서드 추가, 정렬 변경
- `backend/app/services/workflow_definition_service.py` - set_default() 추가, 삭제 시 자동 승계, is_builtin 제약 제거
- `backend/app/api/v1/endpoints/workflow_definitions.py` - POST /{def_id}/set-default 엔드포인트 추가

### Frontend

- `frontend/src/types/workflow.ts` - is_builtin을 is_default로 교체
- `frontend/src/lib/api/workflowDefinition.api.ts` - setDefault API 메서드 추가
- `frontend/src/features/workflow/hooks/useWorkflowDefinitions.ts` - useSetDefaultWorkflowDefinition 훅 추가
- `frontend/src/features/workflow/components/WorkflowDefinitionList.tsx` - "기본 제공" 뱃지를 "Default" 뱃지로 교체
- `frontend/src/features/workflow/components/WorkflowDefinitionDetail.tsx` - builtin 수정/삭제 제한 제거, "기본으로 설정" 버튼 추가
- `frontend/src/features/workflow/components/WorkflowDefinitionsPage.tsx` - is_default 기준 정렬, handleSetDefault 추가
- `frontend/src/features/workflow/components/WorkflowDefinitionSelector.tsx` - default 자동 선택 및 정렬 기준 변경

## 상세 변경 내용

### 1. is_default 컬럼 도입

- DB에 `is_default` Boolean 컬럼 추가 (NOT NULL, default=false)
- 기존 `is_builtin=true` 행을 `is_default=true`로 초기화
- `is_builtin`은 DB에 유지하되 API 응답에서 제거

### 2. 모든 워크플로우 수정/삭제 가능

- `delete_definition()`에서 `is_builtin` 삭제 방지 로직 제거
- UI에서 builtin 워크플로우의 수정/삭제 버튼 가드 제거

### 3. Default 설정 기능

- `POST /workflow-definitions/{id}/set-default` API 엔드포인트
- `clear_all_defaults()` + `set is_default=True` 트랜잭션으로 항상 1개만 유지
- Default 삭제 시 나머지 중 최근 수정된 것이 자동 승계

### 4. UI 변경

- "기본 제공" 뱃지 제거, "Default" 뱃지로 교체 (primary 색상)
- Star 아이콘 버튼으로 "기본으로 설정" 기능 제공
- 목록 정렬: is_default DESC, updated_at DESC

## 테스트 방법

1. 워크플로우 목록에서 Default 뱃지 확인
2. Default가 아닌 워크플로우 선택 후 Star 버튼 클릭하여 Default 변경
3. Default 워크플로우 수정/삭제 가능 확인
4. Default 워크플로우 삭제 시 다른 워크플로우에 자동 승계 확인
5. 세션 생성 시 Default 워크플로우 자동 선택 확인
