# 작업 이력: Git Monitor 모바일 액션 바 버튼 표시 수정

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Git Monitor 페이지의 액션 바가 모바일 화면에서 너비를 초과하여 Commit 버튼과 More 메뉴가 보이지 않는 문제를 수정했습니다. 모바일에서는 버튼 텍스트를 숨기고 아이콘만 표시하도록 반응형 처리를 추가했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/git-monitor/components/GitMonitorPage.tsx` - 액션 버튼 텍스트에 반응형 클래스 추가

## 상세 변경 내용

### 1. 액션 버튼 텍스트 반응형 처리

- Fetch, Pull, Push, Commit 버튼의 텍스트 레이블에 `hidden sm:inline` 클래스를 추가
- 모바일(`<640px`): 아이콘만 표시 → 버튼 너비 대폭 감소
- 데스크톱(`≥640px`): 기존과 동일하게 아이콘 + 텍스트 표시
- 마지막 fetch 시간 표시도 모바일에서 숨김 처리하여 추가 공간 확보

### 2. 문제 원인

- 액션 바가 단일 `flex` 행으로 구성, 모든 버튼이 `shrink-0`(축소 불가)
- `flex-wrap`이나 `overflow` 처리가 없어 좁은 화면에서 우측 요소(Commit, More 메뉴)가 화면 밖으로 밀림

## 테스트 방법

1. 브라우저 DevTools에서 모바일 뷰포트(375px~430px)로 Git Monitor 페이지 확인
2. Commit 버튼(초록색 아이콘)이 화면에 보이는지 확인
3. 데스크톱에서 기존대로 아이콘+텍스트가 모두 표시되는지 확인
