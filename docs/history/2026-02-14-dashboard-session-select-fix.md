# 작업 이력: 대시보드 모드 세션 클릭 시 자동 해제 + 레이아웃 구조 개선

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

대시보드 모드에서 세션을 클릭하면 대시보드가 자동으로 꺼지고 해당 세션의 ChatPanel 화면으로 이동하도록 개선했습니다. 또한 루트 레이아웃의 flex 구조를 조정하여 UsageFooter가 사이드바를 제외한 메인 영역에만 표시되도록 변경했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/routes/__root.tsx` - handleSelect에 dashboardView 해제 로직 추가, 레이아웃 구조 개선

## 상세 변경 내용

### 1. 대시보드 모드 세션 클릭 시 자동 해제

- `handleSelect` 콜백에서 `dashboardView`가 `true`일 때 `setDashboardView(false)` 호출
- 사이드바와 대시보드 그리드 양쪽 모두 동일한 `handleSelect`를 사용하므로 한 곳 수정으로 양쪽 동작 처리
- 기존 문제: 세션 클릭 시 URL만 변경되고 `dashboardView`가 `true`로 유지되어 ChatPanel이 렌더링되지 않음

### 2. 루트 레이아웃 구조 개선

- `UsageFooter`를 사이드바 옆 메인 콘텐츠 영역(`flex-col`) 안으로 이동
- 최상위 flex 구조에서 `flex-col`을 제거하고 사이드바와 메인 영역이 수평으로 배치되도록 정리

## 관련 커밋

- 커밋 후 업데이트 예정

## 테스트 방법

1. 대시보드 모드 ON → 대시보드 카드 클릭 → 대시보드 꺼지고 ChatPanel 표시 확인
2. 대시보드 모드 ON → 사이드바에서 세션 클릭 → 대시보드 꺼지고 ChatPanel 표시 확인
3. 대시보드 모드 OFF → 사이드바에서 세션 클릭 → 기존 동작과 동일 확인
4. UsageFooter가 사이드바 아래가 아닌 메인 콘텐츠 영역 하단에 표시되는지 확인
