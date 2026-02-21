# 작업 이력: 라우팅 정리 및 AssistantText 마크다운 렌더링 수정

- **날짜**: 2026-02-21
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

1. Dashboard/Analytics 뷰를 Zustand 상태 토글에서 URL 기반 라우트로 전환하여 일관된 네비게이션 모델 구축
2. AssistantText 컴포넌트에서 마크다운 렌더링을 적용하여 스트리밍 중에도 테이블/헤더/볼드 등이 정상 표시되도록 수정

## 변경 파일 목록

### Frontend - 라우팅 정리

- `frontend/src/features/dashboard/components/DashboardGrid.tsx` - **신규**: __root.tsx에서 추출한 대시보드 그리드 컴포넌트
- `frontend/src/routes/analytics.tsx` - **신규**: /analytics 라우트 (토큰 분석 페이지)
- `frontend/src/routes/__root.tsx` - costView/dashboardView 조건 분기 및 인라인 컴포넌트 제거
- `frontend/src/routes/index.tsx` - 항상 DashboardGrid 표시하도록 재작성
- `frontend/src/store/useSessionStore.ts` - dashboardView/costView 상태 제거, 버전 마이그레이션 추가
- `frontend/src/features/session/components/Sidebar.tsx` - 토글 버튼을 navigate() 전환, 라우트 기반 active 상태
- `frontend/src/features/command-palette/commands/ui.ts` - dashboard/analytics 토글 커맨드 제거
- `frontend/src/features/command-palette/commands/navigation.ts` - analytics/history 네비게이션 커맨드 추가
- `frontend/src/features/command-palette/hooks/useCommandPalette.ts` - 제거된 store 액션 참조 정리
- `frontend/src/features/analytics/components/SessionRankingTable.tsx` - setCostView(false) 제거
- `frontend/src/routeTree.gen.ts` - TanStack Router 자동 재생성 (/analytics 라우트 추가)

### Frontend - 마크다운 렌더링

- `frontend/src/features/chat/components/MessageBubble.tsx` - AssistantText에서 MarkdownRenderer 사용

## 상세 변경 내용

### 1. 라우팅 정리

**문제**: Dashboard(세션 카드 그리드)와 Token Analytics가 Zustand boolean 토글로 `<Outlet />`을 대체하는 방식이었음. History는 `/history` 라우트가 있어 기준이 불일치.

**해결**:
| 기능 | 변경 전 | 변경 후 |
|------|---------|---------|
| Dashboard | `dashboardView` 토글 | `/` 라우트 (항상 홈) |
| Token Analytics | `costView` 토글 | `/analytics` 라우트 |
| History | `/history` 라우트 | 변경 없음 |
| Split View | `splitView` 토글 | 변경 없음 (디스플레이 모드) |

- `__root.tsx`에서 3중 조건 분기 → SplitView 1개만 유지
- Zustand store에서 `dashboardView`/`costView` 상태·액션 6개 제거
- Store 버전 v1→v2 마이그레이션으로 기존 localStorage 자동 정리
- Sidebar 토글 버튼 → `navigate()` + `useLocation()` 기반 active 상태
- Command Palette에서 토글 커맨드 → 네비게이션 커맨드로 전환

### 2. AssistantText 마크다운 렌더링

**문제**: `AssistantText` 컴포넌트가 `whitespace-pre-wrap`으로 raw text를 렌더링하여 마크다운 문법(##, **, |테이블|, --- 등)이 그대로 노출됨.

**해결**: `ResultMessage`/`ThinkingMessage`와 동일하게 `MarkdownRenderer` 컴포넌트 사용으로 교체. 이미 import되어 있어 1줄 변경으로 해결.

## 관련 커밋

- (커밋 후 업데이트)

## 테스트 방법

1. `/` 접속 → DashboardGrid 표시 확인 (세션 없으면 EmptyState)
2. `/analytics` 접속 → AnalyticsDashboard 표시 확인
3. Sidebar 아이콘 버튼으로 Dashboard/Analytics/History 이동 확인
4. 브라우저 뒤로가기/앞으로가기 정상 동작 확인
5. 채팅에서 Claude 응답의 마크다운(테이블, 헤더, 볼드) 렌더링 확인
