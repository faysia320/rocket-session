# 작업 이력: ArtifactViewer Markdown 렌더링 지원

- **날짜**: 2026-02-24
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

아티팩트 뷰어(Drawer)에서 Plan/Research 아티팩트의 Markdown 콘텐츠가 raw 텍스트로 표시되던 문제를 해결했습니다. 기존 `MarkdownRenderer` 컴포넌트를 통합하고, 3가지 뷰 모드(미리보기/소스/편집) 토글을 추가했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/workflow/components/ArtifactViewer.tsx` - 뷰 모드 상태 + 토글 바 + MarkdownRenderer 통합

## 상세 변경 내용

### 1. 뷰 모드 상태 관리

- `isEditing` boolean을 `ContentViewMode` 3가지 모드(`markdown` | `source` | `edit`)로 교체
- `isEditing`은 파생 값(`viewMode === "edit"`)으로 유지하여 PhaseApprovalBar 호환성 보장
- `lastNonEditMode`로 edit 종료 시 이전 뷰 모드 복귀 지원

### 2. 토글 바 UI

- SheetHeader 아래에 "미리보기"(Eye 아이콘) / "소스"(Code2 아이콘) 탭 버튼 추가
- edit 모드일 때는 토글 바 자동 숨김

### 3. Content 3분기 렌더링

- `markdown` (기본): `MarkdownRenderer`로 헤딩, 리스트, 코드블록 등 렌더링
- `source`: 기존 줄번호 + 주석 거터 raw 뷰 (주석 추가/확인용)
- `edit`: 기존 Textarea (변경 없음)

### 4. scrollToLine 적응

- markdown 모드에서 주석 패널의 줄 번호 클릭 시 자동으로 source 모드 전환 후 스크롤
- `requestAnimationFrame`으로 DOM 업데이트 대기 후 스크롤 실행

### 5. 아티팩트 변경 시 리셋

- 다른 아티팩트를 열면 자동으로 markdown 모드로 초기화

## 테스트 방법

1. 워크플로우에서 아티팩트 열기 → 기본적으로 Markdown 렌더링 확인
2. "소스" 토글 → 기존 줄번호 raw 뷰 + 주석 거터 작동 확인
3. "직접 편집" → Textarea 편집 → "뷰어 모드" → 이전 뷰 모드 복귀 확인
4. 주석 패널에서 줄 번호 클릭 → source 모드 자동 전환 + 스크롤 확인
