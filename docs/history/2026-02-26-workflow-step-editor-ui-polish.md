# 작업 이력: 워크플로우 단계 편집기 UI 개선

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

워크플로우 단계 편집기에서 3가지 UI 개선을 수행했습니다: 프롬프트 템플릿 높이 확대, 아이콘 셀렉트에 실제 아이콘 모양 표시, 생성/수정 날짜 라벨 위치를 상단으로 이동.

## 변경 파일 목록

### Frontend

- `frontend/src/features/workflow/components/WorkflowStepEditor.tsx` - 프롬프트 템플릿 높이 2배, 아이콘 Select UI 개선
- `frontend/src/features/workflow/components/WorkflowDefinitionDetail.tsx` - 생성/수정 날짜 라벨 상단 액션바로 이동

## 상세 변경 내용

### 1. 프롬프트 템플릿 높이 2배 확대

- `Textarea`의 `min-h-[120px]`을 `min-h-[240px]`으로 변경
- 긴 프롬프트 작성 시 더 넓은 편집 공간 제공

### 2. 아이콘 Select에 아이콘 모양 표시

- 하드코딩된 `ICON_OPTIONS` 배열을 `Object.keys(WORKFLOW_ICON_MAP)`으로 교체하여 아이콘 목록 불일치 해소
- `SelectTrigger`와 `SelectItem`에 lucide-react 아이콘 컴포넌트를 렌더링하여 텍스트 이름 옆에 실제 아이콘 모양 표시

### 3. 생성/수정 날짜 라벨 위치 이동

- 하단 메타 정보 영역(border-t 구분선 포함)을 제거
- 상단 액션 바의 Workflow 이름 + Default 뱃지 바로 뒤에 날짜 라벨 배치
- 신규 생성(`isCreating`) 모드에서는 날짜 라벨 비표시

## 테스트 방법

1. Workflows 메뉴에서 워크플로우 정의 선택
2. 상단 바에 생성/수정 날짜가 이름 옆에 표시되는지 확인
3. 수정 모드 진입 후 단계 편집 카드 펼치기
4. 아이콘 Select 드롭다운에서 아이콘 모양이 표시되는지 확인
5. 프롬프트 템플릿 입력 영역이 이전보다 2배 높은지 확인
