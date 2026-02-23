# 작업 이력: Agent Team 기능을 별도 메뉴로 분리

- **날짜**: 2026-02-23
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Agent Team 기능을 세션 사이드바 내부에서 분리하여 독립적인 최상위 네비게이션 섹션으로 격상했습니다. 전용 탭, 전용 사이드바, 전용 목록 페이지, 명령 팔레트 통합을 포함합니다.

## 변경 파일 목록

### Frontend (신규)

- `frontend/src/routes/team/index.tsx` - `/team` 인덱스 라우트
- `frontend/src/features/team/components/TeamListPage.tsx` - 팀 목록/대시보드 페이지 (카드 그리드)
- `frontend/src/features/team/components/TeamCard.tsx` - 팀 카드 컴포넌트
- `frontend/src/features/team/components/TeamSidebar.tsx` - 전용 팀 사이드바 (검색, 필터, 접힘/펼침)
- `frontend/src/features/command-palette/commands/team.ts` - 팀 명령 팔레트 커맨드

### Frontend (수정)

- `frontend/src/features/layout/components/GlobalTopBar.tsx` - Team 탭 추가
- `frontend/src/routes/__root.tsx` - TeamLayout 추가 (3-way 레이아웃 분기)
- `frontend/src/features/session/components/Sidebar.tsx` - 팀 섹션 제거
- `frontend/src/features/command-palette/types.ts` - RouteZone + Category에 team 추가
- `frontend/src/features/command-palette/registry.ts` - `/team` 경로 처리
- `frontend/src/features/command-palette/commands/index.ts` - team export 추가
- `frontend/src/features/command-palette/hooks/useCommandPalette.ts` - 팀 커맨드 통합
- `frontend/src/features/team/hooks/useTeams.ts` - 삭제 후 `/team`으로 이동
- `frontend/src/routeTree.gen.ts` - TeamIndexRoute 타입/등록 추가

## 상세 변경 내용

### 1. GlobalTopBar에 Team 탭 추가

- `NAV_ITEMS` 배열에 Users 아이콘과 `/team` 경로의 Team 항목 추가
- `isActive` 콜백에서 `/team` 경로 prefix 매칭 처리

### 2. 팀 목록 페이지 + 카드 컴포넌트

- `TeamListPage`: 반응형 카드 그리드 (1~4열), 빈 상태 UI, TeamCreateDialog 통합
- `TeamCard`: 상태 뱃지, 멤버 수, 설명, TeamStatusBar 재사용, 클릭 시 팀 상세 이동

### 3. 전용 TeamSidebar

- 세션 Sidebar와 동일한 구조 (접힘/펼침, 모바일 Sheet)
- 검색 입력, 상태 필터 칩 (All/Active/Paused/Done/Archived)
- `useSessionStore`의 `sidebarCollapsed`/`toggleSidebar` 공유

### 4. 루트 레이아웃 TeamLayout 추가

- `isSessionArea`에서 `/team` 분리 → `isTeamArea` 별도 감지
- 3-way 조건부 렌더링: SessionLayout / TeamLayout / Outlet
- TeamSidebar lazy import + Suspense, 모바일 Sheet 지원

### 5. 세션 사이드바에서 팀 섹션 제거

- `useTeams`, `TeamSidebarGroup`, `TeamCreateDialog` import/훅/JSX 모두 제거

### 6. 명령 팔레트 통합

- RouteZone에 `team-home`, `team-detail` 추가
- CommandCategory에 `team` 추가, CATEGORY_LABELS/ORDER 확장
- `resolveRouteZone`에서 `/team` 경로 매핑
- `createTeamCommands`: 정적(팀 홈, 새 팀) + 동적(팀별) 커맨드

### 7. 삭제 후 네비게이션 수정

- `useDeleteTeam` onSuccess: `/` → `/team`으로 변경

## 관련 커밋

- (이 문서와 함께 커밋 예정)

## 테스트 방법

1. GlobalTopBar에 "Team" 탭이 표시되는지 확인
2. "Team" 클릭 시 `/team` 라우트로 이동 + 팀 목록 페이지 표시
3. 좌측에 TeamSidebar가 표시되는지 확인
4. 세션 사이드바에서 팀 섹션이 제거되었는지 확인
5. 명령 팔레트(Ctrl+K)에서 "팀" 검색 시 커맨드 표시
6. 팀 삭제 시 `/team`으로 이동하는지 확인

## 비고

- TypeScript 검사 (`npx tsc --noEmit`) 및 빌드 (`pnpm build`) 모두 통과 확인
- `routeTree.gen.ts`는 TanStack Router가 자동 생성하는 파일이나, Docker 환경에서 dev server가 실행되지 않아 수동으로 TeamIndexRoute를 추가
