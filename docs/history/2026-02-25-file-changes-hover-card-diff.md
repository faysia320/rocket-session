# 작업 이력: File Changes HoverCard Diff

- **날짜**: 2026-02-25
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

FilePanel의 File Changes에서 Diff 보기 방식을 Collapsible(클릭하여 펼치기)에서 HoverCard(마우스 hover로 왼쪽 오버레이)로 교체했습니다. List 모드와 Tree 모드 모두 적용되며, 파일 클릭 시 FileViewer 전체보기 모달이 열립니다.

## 변경 파일 목록

### Frontend

- `frontend/package.json` - `@radix-ui/react-hover-card` 의존성 추가
- `frontend/pnpm-lock.yaml` - lockfile 업데이트
- `frontend/src/components/ui/hover-card.tsx` - shadcn/ui HoverCard 래퍼 컴포넌트 생성
- `frontend/src/features/files/hooks/useDiffFetch.ts` - diff fetch + 캐싱 공유 훅 추출
- `frontend/src/features/files/components/FilePanel.tsx` - Collapsible → HoverCard 교체, DiffHoverContent 추가

## 상세 변경 내용

### 1. HoverCard UI 컴포넌트 생성

- `@radix-ui/react-hover-card` 패키지 설치
- 기존 Tooltip 컴포넌트 패턴을 따라 `hover-card.tsx` 래퍼 생성
- Portal은 `document.body`로 렌더링 (Sheet 내부 overflow clip 회피)

### 2. useDiffFetch 커스텀 훅 추출

- `MergedFileChangeItem`과 `FileTreeFileNode`에 중복되던 diff fetch 로직을 공유 훅으로 추출
- `fetchedRef`로 중복 요청 방지, 한번 fetch 후 캐싱

### 3. FilePanel 리팩토링

- **MergedFileChangeItem** (List 모드): Collapsible → HoverCard 교체
- **FileTreeFileNode** (Tree 모드): Collapsible → HoverCard 교체
- **FileTreeFolderNode**: 기존 Collapsible 유지 (폴더 접기/펼치기)
- ChevronRight 아이콘 + 회전 애니메이션 제거 (파일 노드에서)
- 클릭 동작: 파일 항목 클릭 → FileViewer 전체보기 모달 열기
- HoverCard 설정: openDelay=300ms, closeDelay=150ms, side=left, w-480px, max-h-400px

## 관련 커밋

- (커밋 후 업데이트)

## 테스트 방법

1. Session의 Chat Header에서 File Changes 패널(Sheet) 열기
2. List 모드에서 파일 항목에 마우스 hover → 왼쪽에 HoverCard로 diff 미리보기 확인
3. Tree 모드로 전환 후 동일하게 hover → diff 표시 확인
4. 파일 클릭 시 FileViewer 모달이 열리는지 확인
5. 폴더 노드는 기존처럼 Collapsible 동작 유지 확인
