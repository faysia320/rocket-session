# 작업 이력: 세션 삭제/보관 시 Dashboard 모드 전환 및 기타 개선

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

세션 삭제/보관 후 viewMode가 변경되지 않아 Sidebar 버튼 상태가 불일치하던 문제를 수정하고,
History 페이지를 Dashboard에 통합하며, Analytics API에 에러 핸들링을 추가했습니다.

## 변경 파일 목록

### Backend

- `backend/app/api/v1/endpoints/analytics.py` - 에러 핸들링 및 로깅 추가
- `backend/app/repositories/token_snapshot_repo.py` - GROUP BY 누락 컬럼 추가

### Frontend

- `frontend/src/features/session/hooks/useSessions.ts` - 삭제/보관 후 Dashboard 모드 전환 로직 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - 워크트리 삭제 시 Dashboard 모드 전환
- `frontend/src/routes/index.tsx` - Dashboard에 HistoryPage 통합
- `frontend/src/routes/history.tsx` - 독립 라우트 삭제
- `frontend/src/features/history/components/HistoryPage.tsx` - className prop 추가, 크기 조정
- `frontend/src/features/layout/components/GlobalTopBar.tsx` - History 네비게이션 항목 제거
- `frontend/src/features/command-palette/commands/navigation.ts` - History 명령 제거
- `frontend/src/features/command-palette/registry.ts` - history 존 제거
- `frontend/src/features/command-palette/types.ts` - RouteZone에서 history 제거
- `frontend/src/routeTree.gen.ts` - 라우트 트리 재생성

## 상세 변경 내용

### 1. 세션 삭제/보관 시 Dashboard 모드 전환

- `getPostDeleteTarget()`에서 `"/"` 반환 시 `setViewMode("dashboard")` 호출 추가
- `useSessionMutations().archiveSession()`에 네비게이션 로직 추가 (기존에는 mutation만 수행)
- `ChatPanel.handleRemoveWorktree`에 `setViewMode("dashboard")` 추가

### 2. History 페이지 Dashboard 통합

- `/history` 독립 라우트를 제거하고 Dashboard(`/`) 하단에 통합
- HistoryPage에 `className` prop 추가하여 유연한 레이아웃 적용
- GlobalTopBar, Command Palette에서 History 관련 항목 제거

### 3. Analytics API 에러 핸들링

- analytics 엔드포인트에 try/except + 로깅 추가
- token_snapshot 쿼리에서 GROUP BY 누락 컬럼(`top_sessions.c.total`) 추가

## 관련 커밋

- `Fix: Add error handling to analytics API endpoint`
- `Refactor: Integrate History page into Dashboard`
- `Fix: Switch to Dashboard mode on session delete/archive`

## 테스트 방법

1. Single 모드에서 세션 보관/삭제 → Dashboard 모드로 전환 확인
2. Split 모드에서 모든 세션 삭제 → Dashboard 모드로 전환 확인
3. Split 모드에서 일부 세션 삭제 → Split 모드 유지 확인
4. Sidebar 하단 버튼 활성 상태가 Dashboard로 변경되는지 확인
