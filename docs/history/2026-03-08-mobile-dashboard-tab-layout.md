# 작업 이력: 모바일 대시보드 탭 레이아웃 수정

- **날짜**: 2026-03-08
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

대시보드 인덱스 페이지에서 모바일 탭 레이아웃이 활성 세션 0개일 때 적용되지 않는 문제와, 탭 내 HistoryPage 스크롤이 동작하지 않는 문제를 수정했습니다.

## 변경 파일 목록

### Frontend

- `frontend/src/routes/index.tsx` - 모바일 분기 순서 변경, TabsContent flex 체인 수정

## 상세 변경 내용

### 1. 모바일 탭 분기 순서 변경

- **문제**: `activeSessions === 0` 분기가 `isMobile` 분기보다 먼저 실행되어, 활성 세션이 없으면 모바일에서도 수직 스택(EmptyState + HistoryPage)으로 렌더링됨
- **수정**: `isMobile` 분기를 최상위로 이동하여 모바일에서는 빈 상태 포함 항상 탭 레이아웃 적용
- 빈 상태일 때 `defaultValue="history"`로 히스토리 탭 기본 선택
- dashboard 탭 내부에서 `isEmpty ? <EmptyState /> : <DashboardGrid />` 조건 분기

### 2. TabsContent flex 높이 체인 수정

- **문제**: `TabsContent`에 `flex flex-col`이 없어 자식 HistoryPage의 `flex-1`이 높이를 할당받지 못함 → ScrollArea 스크롤 불가
- **수정**: 두 `TabsContent` 모두 `"flex-1 flex flex-col overflow-hidden m-0"`으로 변경

## 테스트 방법

1. 브라우저 DevTools에서 모바일 뷰포트(< 768px)로 전환
2. 활성 세션 0개: "세션 현황" / "히스토리" 탭 표시, "히스토리" 탭이 기본 선택됨 확인
3. 활성 세션 있을 때: 탭 전환 정상, "히스토리" 탭에서 세션 목록 스크롤 정상 확인
4. 데스크톱: 기존 상하 2분할 레이아웃 변경 없음 확인
