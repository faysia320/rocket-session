# 작업 이력: Workflow + Node 메뉴 통합 및 Step Editor UX 개선

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

별도로 분리되어 있던 Workflow Definitions(`/workflows`)와 Workflow Nodes(`/nodes`) 메뉴를 하나의 `/workflows` 페이지로 통합하고, Step Editor에 드래그앤드롭(DnD) 재정렬과 시각적 파이프라인 UI를 추가하여 워크플로우 구성 UX를 개선했습니다.

## 변경 파일 목록

### Frontend - 신규 생성

- `frontend/src/features/workflow/utils/workflowIcons.ts` - 3개 파일에 중복된 ICON_MAP을 공유 유틸리티로 추출
- `frontend/src/features/workflow/components/WorkflowPage.tsx` - Definitions/Nodes 탭을 포함하는 통합 페이지

### Frontend - 수정

- `frontend/package.json` - @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities 의존성 추가
- `frontend/src/routes/workflows.tsx` - WorkflowPage lazy import으로 전환
- `frontend/src/routes/nodes.tsx` - `/workflows`로 redirect 처리
- `frontend/src/features/layout/components/GlobalTopBar.tsx` - Nodes 네비게이션 항목 제거
- `frontend/src/features/command-palette/commands/navigation.ts` - 워크플로우 커맨드에 "node", "노드" 키워드 추가
- `frontend/src/features/workflow/components/WorkflowStepEditor.tsx` - DnD + 연결선 + 인라인 배지 전면 개선
- `frontend/src/features/workflow/components/WorkflowDefinitionDetail.tsx` - 공유 ICON_MAP import 전환
- `frontend/src/features/workflow/components/WorkflowProgressBar.tsx` - 공유 ICON_MAP import 전환

## 상세 변경 내용

### 1. 메뉴 통합 (Definitions + Nodes → 탭 UI)

- GlobalTopBar에서 Nodes 항목 제거 (7→6개 메뉴)
- `/workflows` 페이지에 shadcn Tabs 컴포넌트로 Definitions/Nodes 탭 구성
- `/nodes` URL은 `/workflows`로 자동 redirect (하위 호환성 유지)
- 기존 WorkflowDefinitionsPage, WorkflowNodesPage 컴포넌트는 변경 없이 탭 내부에서 재사용

### 2. Step Editor DnD + 시각적 개선

- @dnd-kit 기반 드래그앤드롭 정렬 구현 (PointerSensor + KeyboardSensor)
- GripVertical 아이콘에 실제 drag handle 바인딩 (기존에는 장식용)
- 스텝 카드 사이 수직 연결선 + 화살표로 파이프라인 흐름 시각화
- 접힌 상태 헤더에 인라인 배지 추가: 순서 번호, "자동"(info), "승인"(warning), constraints
- SortableStepCard 서브 컴포넌트 추출로 코드 구조 개선

### 3. ICON_MAP 공유 유틸리티

- WorkflowStepEditor, WorkflowDefinitionDetail, WorkflowProgressBar 3개 파일의 중복 ICON_MAP을 `workflowIcons.ts`로 통합
- `WORKFLOW_ICON_MAP` 상수 + `resolveWorkflowIcon()` 함수 제공

## 테스트 방법

1. 네비게이션 바에서 "Nodes" 메뉴가 사라졌는지 확인
2. "Workflows" 클릭 시 Definitions/Nodes 탭이 있는 통합 페이지 확인
3. 브라우저에서 `/nodes` 접근 시 `/workflows`로 리다이렉트 확인
4. Definitions 탭: 워크플로우 정의 CRUD 정상 동작 확인
5. Nodes 탭: 워크플로우 노드 CRUD 정상 동작 확인
6. 정의 편집 시 스텝 카드를 드래그하여 순서 변경 확인
7. 커맨드 팔레트에서 "노드" 검색 시 "워크플로우 관리" 노출 확인

## 비고

- 백엔드 API 변경 없음 (프론트엔드만 변경)
- 기존 WorkflowDefinitionsPage, WorkflowNodesPage 컴포넌트는 수정 없이 탭 콘텐츠로 재사용
- TabsContent에 forceMount + data-[state=inactive]:hidden 패턴 적용하여 탭 전환 시 불필요한 리마운트 방지
