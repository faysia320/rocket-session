# 작업 이력: 헤더 Tooltip 개선 및 FileViewer 높이 수정

- **날짜**: 2026-02-19
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

ChatHeader의 work dir/branch 라벨에 shadcn/ui Tooltip을 적용하고, branch 라벨에 말줄임표(truncate)를 추가했습니다. FileViewer의 Dialog 높이를 max-h에서 고정 h로 변경하여 스크롤 영역을 안정화했습니다.

## 변경 파일 목록

### Frontend

- `src/features/chat/components/ChatHeader.tsx` - native title → shadcn/ui Tooltip, branch truncate 추가
- `src/features/files/components/FileViewer.tsx` - DialogContent max-h-[80vh] → h-[80vh]

## 상세 변경 내용

### 1. ChatHeader Tooltip 개선

- Work dir 라벨: native `title` 속성을 shadcn/ui `Tooltip` 컴포넌트로 교체
- Branch 라벨: `truncate max-w-[150px]` 추가 + shadcn/ui `Tooltip` 적용
- 두 라벨 모두 hover 시 일관된 스타일의 tooltip 표시

### 2. FileViewer Dialog 높이 수정

- `max-h-[80vh]` → `h-[80vh]`로 변경하여 Dialog가 항상 80vh 높이를 유지
- 내용이 적어도 일관된 크기의 Dialog 표시

## 테스트 방법

1. 세션 헤더의 work dir 라벨 hover → shadcn/ui 스타일 tooltip 표시 확인
2. 긴 branch 이름에서 말줄임표 + tooltip 동작 확인
3. File Changes에서 파일 전체보기 → Dialog 높이가 80vh로 고정 확인
