# 작업 이력: 디자인 수정 3건 (Badge 정렬, 전체보기 스크롤바, Split View 외곽선)

- **날짜**: 2026-02-19
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

File Changes Drawer의 Badge/X 버튼 정렬, FileViewer 전체보기 Modal 스크롤바 미노출, Split Mode 포커스 외곽선 가시성 등 3가지 디자인 이슈를 수정했습니다.

## 변경 파일 목록

### Frontend

- `src/components/ui/sheet.tsx` - X 닫기 버튼 세로 위치 조정 (top-4 → top-3)
- `src/features/files/components/FileViewer.tsx` - DialogContent에 overflow-hidden 추가
- `src/routes/__root.tsx` - Split View 포커스 외곽선 두께 및 투명도 증가

## 상세 변경 내용

### 1. Badge와 X 닫기 버튼 middle 정렬

- Sheet X 닫기 버튼이 `absolute top-4`(16px)에 위치하여 FilePanel 헤더의 Badge와 수직 정렬이 맞지 않았음
- `top-4` → `top-3`(12px)으로 변경하여 헤더 `py-2.5`(10px) 패딩 기준 중앙 정렬과 일치시킴

### 2. FileViewer 전체보기 Modal 스크롤바

- `DialogContent`에 `max-h-[80vh]` + `flex flex-col`이 적용되어 있었으나, 기본 클래스의 `grid` display 속성과 충돌하여 flex-1 자식의 높이 계산이 제대로 되지 않았음
- `overflow-hidden`을 추가하여 `max-h-[80vh]` 제한이 자식 flex 요소로 올바르게 전파되도록 수정
- ScrollArea가 높이를 인식하여 스크롤바가 정상 표시됨

### 3. Split Mode 포커스 외곽선 가시성

- 기존: `border`(1px) + `border-primary/40`(40% 투명도) → 거의 보이지 않음
- 변경: `border-2`(2px) + `border-primary/50`(50% 투명도) → 포커스 세션이 명확하게 구분됨

## 테스트 방법

1. File Changes Drawer 열기 → Badge 수와 X 닫기 버튼의 세로 정렬 확인
2. File Changes에서 파일의 전체보기(Maximize) 클릭 → Dialog에 스크롤바 표시 확인
3. Split Mode 진입 → 세션 클릭 → 포커스 외곽선 가시성 확인
