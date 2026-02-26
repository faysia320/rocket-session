# 작업 이력: File Changes 패널 UI 개선

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

File Changes 패널의 diff hover card UX를 전면 개선. 모바일 대응(클릭=hover), hover card 내 전체보기 이동, git diff 헤더 제거, 너비 확대, tree view 기본화, diff 겹침 방지 등 6가지 요청을 일괄 반영.

## 변경 파일 목록

### Frontend

- `frontend/src/features/files/components/FilePanel.tsx` - HoverCard controlled 모드, 전체보기 아이콘 이동, tree view 기본값, 너비 확대, 겹침 방지
- `frontend/src/features/files/components/DiffViewer.tsx` - hideHeaders prop 추가, virtualizer 동적 높이 측정

## 상세 변경 내용

### 1. Diff Hover Card에서 git diff 헤더 제거

- `DiffViewer`에 `hideHeaders?: boolean` prop 추가
- `hideHeaders` 활성화 시 `diff --git`, `index`, `---`, `+++` 라인(type: "info") 필터링
- hover card에서만 적용, FileViewer 모달은 기존대로 전체 diff 표시

### 2. Hover Card 너비 1.5배 확대

- `w-[480px]` → `w-[720px]` (MergedFileChangeItem, FileTreeFileNode 두 곳)
- `max-h-[400px]` → `max-h-[450px]`으로 약간 확대 (헤더바 공간 확보)
- `flex flex-col` 추가하여 헤더바 + diff 콘텐츠 분리

### 3. Tree View 기본 뷰 + 아이콘 순서 변경

- `useState<FileViewMode>("list")` → `"tree"`로 기본값 변경
- FolderTree 아이콘을 List 아이콘 앞으로 이동 (트리뷰가 왼쪽)

### 4. x2 변경사항 diff 겹침 해결

- `FilePanel`에 `openHoverFile` state 추가 (한 번에 하나의 hover card만 열림)
- `MergedFileChangeItem`, `FileTreeFileNode`에 `isHoverOpen` / `onHoverOpenChange` prop 전달
- `DiffViewer`의 virtualizer에 `measureElement` 추가하여 동적 높이 측정 (줄 바꿈 시 겹침 방지)
- 가상화 아이템에서 고정 `height` 스타일 제거

### 5. 전체보기 아이콘 이동 (파일 리스트 → Hover Card 내부)

- MergedFileChangeItem, FileTreeFileNode에서 Maximize2 아이콘 Tooltip 블록 제거
- `DiffHoverContent`에 `fileName`, `onFullView` prop 추가
- hover card 상단에 헤더바 추가: 파일명 표시 + Maximize2 전체보기 버튼
- `e.stopPropagation()` 적용하여 버블링 방지

### 6. 클릭 = hover 동작 (모바일 대응)

- HoverCard를 uncontrolled → controlled 모드로 전환 (`open` + `onOpenChange`)
- `openSourceRef`로 open 소스 추적: hover로 열면 hover-leave로 닫힘, click으로 열면 유지
- 파일 항목 클릭 시 hover card toggle (모바일 터치 지원)
- 전체보기(FileViewer)는 hover card 내부 아이콘으로만 접근

## 관련 커밋

- (이 문서와 함께 커밋)

## 테스트 방법

1. File Changes 패널 열기 → tree view가 기본 표시되는지 확인
2. 파일 항목 hover → diff 미리보기 카드에 git diff 헤더 없이 코드 변경점만 표시
3. hover card 너비가 기존보다 넓은지 확인 (720px)
4. hover card 상단에 파일명 + 전체보기(Maximize2) 아이콘 확인
5. 파일 항목 클릭 → hover card가 열리는지 확인 (모바일 시뮬레이션)
6. hover card 내 전체보기 클릭 → FileViewer 모달 열리는지 확인
7. x2 파일을 빠르게 전환하며 카드 겹침 없는지 확인
