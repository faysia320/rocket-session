# 작업 이력: Workflow Selector 정렬 및 definition_id 전달 수정

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

New Session의 WORKFLOW DEFINITION 드롭다운에서 Default(builtin) 워크플로우가 항상 첫 번째에 표시되도록 정렬 로직을 추가하고, 세션 생성 시 선택한 workflow_definition_id가 응답에 포함되지 않던 버그를 수정했습니다.

## 변경 파일 목록

### Backend

- `backend/app/repositories/session_repo.py` - `_session_to_dict()`에 `workflow_definition_id` 필드 추가

### Frontend

- `frontend/src/features/workflow/components/WorkflowDefinitionSelector.tsx` - `is_builtin` 우선 정렬 로직 추가
- `frontend/src/lib/api/sessions.api.ts` - create options 타입에 `workflow_definition_id` 추가

## 상세 변경 내용

### 1. Workflow Selector 정렬

- `WorkflowDefinitionsPage`에 이미 존재하는 `is_builtin` 우선 정렬 패턴을 `WorkflowDefinitionSelector`에도 적용
- `useMemo`로 `sortedDefinitions`를 생성하여 builtin 항목이 항상 목록 최상단에 위치

### 2. workflow_definition_id 파이프라인 수정

- `_session_to_dict()`에서 `workflow_definition_id` 필드가 누락되어 ORM → dict 변환 시 값이 사라지던 문제 수정
- `sessions.api.ts`의 create options TypeScript 타입에 `workflow_definition_id` 필드 추가

## 테스트 방법

1. New Session 페이지에서 WORKFLOW DEFINITION 드롭다운 열기 → Default가 항상 첫 번째
2. 커스텀 워크플로우 선택 후 세션 생성 → 선택한 워크플로우로 동작하는지 확인
