# 작업 이력: Dashboard → Single/Split 뷰 모드 전환 버그 수정

- **날짜**: 2026-02-22
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Dashboard 뷰에서 Single/Split 모드로 전환할 때 아무 반응이 없는 버그를 수정했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/session/components/Sidebar.tsx` - Single/Split 버튼에 라우트 네비게이션 추가

## 상세 변경 내용

### 1. 뷰 모드 전환 버그 수정

- **문제**: Dashboard 버튼은 `navigate({ to: "/" })`로 라우트를 이동했지만, Single/Split 버튼은 Zustand 상태(`viewMode`)만 변경하고 라우트 네비게이션을 하지 않았음
- **원인**: Dashboard 상태에서 현재 경로가 `/`이므로, viewMode만 바꿔도 세션 상세 페이지(`/session/:id`)로 이동하지 않아 UI가 반영되지 않음
- **수정**: Single/Split 버튼 클릭 시 `activeSessionId`가 있으면 `/session/$sessionId` 라우트로 네비게이션하도록 추가

## 관련 커밋

- `(예정)` - Fix: Dashboard에서 Single/Split 뷰 모드 전환 안 되는 버그 수정

## 테스트 방법

1. 세션이 하나 이상 있는 상태에서 Dashboard 뷰로 전환
2. Single 버튼 클릭 → 해당 세션의 채팅 화면으로 이동 확인
3. 다시 Dashboard로 전환 후 Split 버튼 클릭 → 분할 뷰로 이동 확인
