# 작업 이력: 메모 기능 4가지 개선 (라이브 마크다운 프리뷰 외)

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

메모 블록 에디터의 4가지 핵심 개선사항을 구현:
1. 옵시디안 스타일 라이브 마크다운 프리뷰 (커서 위치 기반 원본/서식 토글)
2. Backspace 연타 시 "블록을 찾을 수 없습니다" 에러 수정
3. 블록 내 줄번호 생성 (기존 블록 인덱스 대신 CodeMirror lineNumbers)
4. 비활성 블록 전체 줄 표시 (remark-breaks + 항상 에디터 모드)

## 변경 파일 목록

### Frontend (신규)

- `frontend/src/features/memo/extensions/liveMarkdownPreview.ts` - CodeMirror 6 ViewPlugin 기반 라이브 마크다운 프리뷰 + 테마

### Frontend (수정)

- `frontend/src/features/memo/components/MemoBlockItem.tsx` - isEditing 토글 제거, 항상 에디터 렌더링, handleDelete 래퍼 추가
- `frontend/src/features/memo/components/MemoBlockEditor.tsx` - lineNumbers/liveMarkdownPreview 확장 추가, gutter 스타일링
- `frontend/src/features/memo/hooks/useMemo.ts` - optimistic delete, 404 에러 무시
- `frontend/src/components/ui/MarkdownRenderer.tsx` - enableBreaks prop 추가 (remark-breaks)
- `frontend/package.json` - remark-breaks 의존성 추가

## 상세 변경 내용

### 1. 옵시디안 스타일 라이브 마크다운 프리뷰

- CodeMirror 6 ViewPlugin으로 마크다운 서식을 인라인 데코레이션으로 적용
- 커서가 있는 줄은 원본 마크다운 표시, 나머지는 서식 데코레이션
- 지원 요소: 제목(H1~H6), 볼드, 이탤릭, 취소선, 인라인 코드, 링크, 인용문, 수평선, 리스트, 체크박스
- Lezer 구문 트리를 순회하여 노드별 Decoration.replace/mark/widget 적용
- 기존 편집/프리뷰 이중 모드를 완전 제거

### 2. Backspace 버그 수정

- 삭제 전 타이머 클리어 + pendingContentRef 초기화로 stale save 방지
- deletedRef 플래그로 unmount 시 삭제된 블록의 flush 방지
- useDeleteMemoBlock에 optimistic update 추가 (즉시 캐시 제거 + rollback)
- useUpdateMemoBlock에서 404 에러 무시 (삭제된 블록에 대한 stale save)

### 3. 블록 내 줄번호

- CodeMirror lineNumbers() extension 추가
- 투명 배경, 11px, muted 색상의 gutter 스타일링
- 기존 블록 인덱스 gutter 제거

### 4. 비활성 블록 전체 줄 표시

- remark-breaks 패키지로 단일 줄바꿈을 <br>로 변환
- MarkdownRenderer에 enableBreaks prop 추가
- 라이브 프리뷰 도입으로 모든 블록이 항상 에디터 모드 → 전체 줄 자동 표시

## 테스트 방법

1. 메모 패널 열기
2. `## 제목` 입력 후 다른 줄로 이동 → `##` 숨겨지고 서식 적용 확인
3. 블록에 텍스트 입력 후 backspace 연타 → 에러 토스트 없음 확인
4. 여러 줄 입력 → 좌측에 줄번호 표시 확인
5. 다른 블록 클릭 → 이전 블록이 서식 적용된 상태로 전체 줄 표시 확인
