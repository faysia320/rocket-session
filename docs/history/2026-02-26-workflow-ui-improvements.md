# 작업 이력: Workflow 메뉴 UI 개선

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Workflows 메뉴의 6가지 UX 개선: 중복 순서 버튼 제거, Left Panel 보더 일관성, 액션 버튼 Left Panel 이동(Git 패턴), 프롬프트 전체 표시, Default 정의 최상단 고정, 탭 라벨 헤더 제거.

## 변경 파일 목록

### Frontend

- `frontend/src/features/workflow/components/WorkflowStepEditor.tsx` - 순서 이동 버튼 및 moveStep 함수 제거
- `frontend/src/features/workflow/components/WorkflowDefinitionList.tsx` - onAdd/onImport props 추가, 헤더에 아이콘 버튼 배치
- `frontend/src/features/workflow/components/WorkflowNodeList.tsx` - onAdd prop 추가, 헤더에 아이콘 버튼 배치
- `frontend/src/features/workflow/components/WorkflowDefinitionsPage.tsx` - 탭 라벨 헤더/EmptyState 제거, is_builtin 정렬 추가
- `frontend/src/features/workflow/components/WorkflowNodesPage.tsx` - 탭 라벨 헤더/EmptyState 제거
- `frontend/src/features/workflow/components/WorkflowDefinitionDetail.tsx` - 프롬프트 전체 표시 + 30줄 펼치기

## 상세 변경 내용

### 1. 단계 구성 순서 버튼 제거

- ChevronUp/ChevronDown 이동 버튼 2개 삭제 (DnD로 대체)
- `moveStep` 함수, `onMoveUp`/`onMoveDown` props, `totalSteps` prop 제거
- Drag & Drop(GripVertical 핸들)만 유지

### 2. Left Panel 보더 항상 표시

- EmptyState 분기 제거하여 데이터 0건이어도 Left Panel(border-r) 항상 렌더링
- Detail 컴포넌트의 기존 빈 상태 안내 메시지 활용

### 3. 액션 버튼 Left Panel 이동

- Git 메뉴의 GitMonitorRepoList 패턴 적용 (ghost 아이콘 버튼 h-5 w-5)
- DefinitionList: Upload(가져오기) + Plus(새 정의) 버튼
- NodeList: Plus(새 노드) 버튼
- Tooltip으로 버튼 설명 표시

### 4. 프롬프트 템플릿 전체 표시

- 읽기 모드에서 line-clamp-3 제거 → 전체 표시
- 30줄 초과 시에만 line-clamp-[30] + 펼치기/접기 토글 버튼
- expandedPrompts 상태로 각 step별 독립 제어

### 5. Default 정의 최상단 고정

- readyDefinitions 정렬에서 is_builtin 우선 정렬
- `sort((a, b) => Number(b.is_builtin) - Number(a.is_builtin))`

### 6. 탭 라벨 헤더 제거

- DefinitionsPage/NodesPage의 "Workflow Definitions"/"Workflow Nodes" 헤더 영역 삭제
- 불필요해진 import(Workflow, Blocks, Plus, Upload, Button) 정리
- EmptyState 컴포넌트 삭제

## 관련 커밋

- Feat: Workflow 메뉴 UI 개선 6종

## 비고

- TypeScript, ESLint, Vite 빌드 모두 통과 확인
