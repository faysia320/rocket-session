# 작업 이력: 메모 블록 병합/Undo 및 모바일 반응형 개선

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

메모 블록 간 병합(Backspace at start) 기능, 구조적 Undo(Ctrl+Z) 기능을 추가하고, MemoPanel에 모바일 반응형 레이아웃을 적용했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/memo/hooks/useMemoEditorRegistry.ts` - 에디터 레지스트리 훅 (신규)
- `frontend/src/features/memo/hooks/useMemoUndoStack.ts` - 구조적 Undo 스택 Zustand 스토어 (신규)
- `frontend/src/features/memo/components/MemoBlockEditor.tsx` - blockId/editorRegistry props 추가, backspace-at-start 핸들러
- `frontend/src/features/memo/components/MemoBlockItem.tsx` - 삭제+포커스, 병합 콜백 분리
- `frontend/src/features/memo/components/MemoBlockList.tsx` - 병합 로직, 구조적 Undo, 에디터 레지스트리 통합
- `frontend/src/features/memo/components/MemoPanel.tsx` - 모바일 전체화면 레이아웃, 드래그 비활성화

## 상세 변경 내용

### 1. 에디터 레지스트리 (useMemoEditorRegistry)

- 각 블록의 CodeMirror EditorView를 blockId로 관리
- register/unregister로 마운트/언마운트 시 자동 등록
- getView, getContent, focusEnd, focusAt으로 크로스 블록 조작 지원

### 2. 구조적 Undo 스택 (useMemoUndoStack)

- Zustand 기반 글로벌 스토어
- 블록 생성(create_block), 삭제(delete_block), 병합(merge_blocks) 3종류 액션 지원
- 최대 50개 스택, 5분 만료 정책
- lastActionWasStructural 플래그로 텍스트 undo와 구조적 undo 구분

### 3. 블록 병합 기능

- 커서가 블록 맨 앞(pos 0)에서 Backspace → 이전 블록과 내용 병합
- 이전 블록 끝에 현재 블록 내용 추가 후 현재 블록 삭제
- 포커스가 합류 지점(이전 블록 원래 길이)으로 자동 이동

### 4. MemoPanel 모바일 반응형

- 모바일에서 전체화면(inset-0), 데스크톱에서 기존 고정 크기 유지
- 모바일에서 드래그 핸들러 비활성화
- useIsMobile 훅 활용

## 관련 커밋

- `<hash>` - Feat: Add memo block merge and structural undo
- `<hash>` - Design: Add mobile responsive layout for MemoPanel

## 테스트 방법

1. 메모 패널에서 블록 2개 이상 생성
2. 두 번째 블록 맨 앞에서 Backspace → 이전 블록과 병합 확인
3. Ctrl+Z → 병합 취소 (블록 복원) 확인
4. 빈 블록 Backspace → 삭제 후 이전 블록 포커스 확인
5. 모바일 뷰포트에서 메모 패널이 전체화면으로 표시되는지 확인
