# 작업 이력: 워크플로우 auto_advance 필드 제거 및 로직 단순화

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우 단계 진행 시 `auto_advance`와 `review_required` 두 개의 불리언 플래그로 제어하던 방식을 `review_required` 하나로 단순화했습니다. 기존에 `auto_advance=true, review_required=false` 조합이 실질적으로 `review_required=false`와 동일했기 때문에 불필요한 복잡성을 제거했습니다.

## 변경 파일 목록

### Backend

- `backend/app/schemas/workflow_definition.py` - `auto_advance` 필드 제거
- `backend/app/services/claude_runner.py` - 단계 완료 후 분기 로직을 3가지로 단순화
- `backend/app/services/workflow_definition_service.py` - 기본 워크플로우 정의에서 `auto_advance` 제거
- `backend/app/api/v1/endpoints/workflow.py` - 주석 정리

### Frontend

- `frontend/src/types/workflow.ts` - `WorkflowStepConfig`에서 `auto_advance` 제거
- `frontend/src/features/workflow/components/WorkflowDefinitionDetail.tsx` - 뱃지 표시 및 데이터 매핑에서 제거
- `frontend/src/features/workflow/components/WorkflowStepEditor.tsx` - "자동 진행" 체크박스 UI 제거

## 상세 변경 내용

### 1. 워크플로우 단계 진행 로직 단순화 (claude_runner.py)

기존 4가지 분기를 3가지로 정리:
- **다음 단계 없음** → 워크플로우 완료
- **`review_required=false`** → 자동 승인 + 다음 단계 실행
- **`review_required=true`** → 사용자 승인 대기 (`awaiting_approval`)

### 2. 스키마/타입 정리

`WorkflowStepConfig`에서 `auto_advance: bool` 필드를 제거하여 설정이 더 직관적으로 변경됨.

### 3. UI 정리

워크플로우 에디터에서 "자동 진행" 체크박스를 제거하고, 단계 목록의 "자동" 뱃지 표시도 제거.

## 관련 커밋

- 단일 커밋으로 처리

## 비고

- `auto_advance`는 `review_required`의 반대 개념으로, 두 플래그가 공존할 필요가 없었음
- DB 마이그레이션은 불필요 (JSONB 내부 필드이므로 스키마 변경 없음)
