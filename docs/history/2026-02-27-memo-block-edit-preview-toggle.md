# 작업 이력: 메모 블록 편집/미리보기 모드 전환 및 UI 개선

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

메모 블록에 편집/미리보기 모드 전환 기능을 추가하고, 라인 넘버 표시 및 교차 배경색 UI를 적용했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/memo/components/MemoBlockEditor.tsx` - `onBlur` prop 추가로 에디터 포커스 해제 이벤트 지원
- `frontend/src/features/memo/components/MemoBlockItem.tsx` - 편집/미리보기 모드 토글, 라인 넘버, 교차 배경색, MarkdownRenderer 미리보기
- `frontend/src/features/memo/components/MemoBlockList.tsx` - `index` prop 전달

## 상세 변경 내용

### 1. MemoBlockEditor onBlur 이벤트 지원

- `onBlur` optional prop 추가
- `EditorView.domEventHandlers`를 사용하여 blur 이벤트 핸들러 등록
- ref 패턴으로 최신 콜백 참조 유지

### 2. MemoBlockItem 편집/미리보기 모드 전환

- `isEditing` 상태 추가: autoFocus이거나 빈 블록이면 편집 모드로 시작
- 편집 모드: 기존 CodeMirror 에디터 표시
- 미리보기 모드: `MarkdownRenderer` 컴포넌트로 마크다운 렌더링
- blur 시 내용이 있으면 자동으로 미리보기 모드로 전환
- 미리보기 클릭 시 편집 모드로 전환

### 3. 라인 넘버 및 교차 배경색 UI

- `index` prop을 받아 1-based 라인 넘버 표시 (좌측 고정 영역)
- 짝수/홀수 행에 따라 `bg-background` / `bg-muted/30` 교차 배경색 적용

## 관련 커밋

- (커밋 후 업데이트 예정)

## 테스트 방법

1. 메모 탭에서 블록 내용 입력
2. 블록 외부 클릭(blur) 시 마크다운 미리보기로 전환 확인
3. 미리보기 클릭 시 편집 모드로 복귀 확인
4. 라인 넘버 및 교차 배경색 표시 확인
