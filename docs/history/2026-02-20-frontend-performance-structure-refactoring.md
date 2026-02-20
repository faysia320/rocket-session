# 작업 이력: 프론트엔드 성능 및 코드 구조 개선

- **날짜**: 2026-02-20
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

프론트엔드 코드 전체를 대상으로 성능 개선 및 코드 구조 개선 6개 Phase를 수행했습니다. 에러 처리 강화, 타입 안전성 개선, API 클라이언트 재설계, 중복 코드 제거, ChatPanel 분해, 렌더 최적화, Dead code 삭제를 포함합니다.

## 변경 파일 목록

### 새로 생성된 파일

- `frontend/src/features/chat/hooks/useChatNotifications.ts` - ChatPanel에서 추출한 알림 로직 훅
- `frontend/src/features/chat/hooks/useChatSearch.ts` - ChatPanel에서 추출한 검색 로직 훅
- `frontend/src/features/chat/hooks/usePlanActions.ts` - ChatPanel에서 추출한 Plan 액션 훅
- `frontend/src/features/chat/components/ChatSearchBar.tsx` - 메모이즈된 검색바 컴포넌트

### 삭제된 파일

- `frontend/src/features/chat/components/ModelSelector.tsx` - 부작용 전용 컴포넌트, 로직을 ChatHeader로 이동
- `frontend/src/features/chat/hooks/useDesktopNotification.ts` - 미사용 Dead code

### 수정된 파일 (33개)

#### 에러 처리 및 타입 안전성 (Phase 1)

- `frontend/src/components/ui/ErrorBoundary.tsx` - onReset prop, AppErrorFallback 컴포넌트 추가
- `frontend/src/App.tsx` - 전역 ErrorBoundary 래핑
- `frontend/src/features/mcp/hooks/useMcpServers.ts` - Mutation onError 콜백 4개 추가
- `frontend/src/features/settings/hooks/useGlobalSettings.ts` - Mutation onError 콜백 추가
- `frontend/src/types/message.ts` - `_truncated` 필드 추가
- `frontend/src/types/session.ts` - `SessionStats` 공유 인터페이스 추가
- `frontend/src/types/index.ts` - SessionStats barrel export
- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - `as any` 제거, HistoryItem export
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - 타입 캐스트 개선
- `frontend/src/features/session/hooks/useSessionStats.ts` - 공유 SessionStats 사용

#### API 클라이언트 (Phase 2)

- `frontend/src/lib/api/client.ts` - AbortController 타임아웃, getBlob(), postFormData() 추가
- `frontend/src/lib/api/sessions.api.ts` - 타입 안전 반환, getBlob/postFormData 사용
- `frontend/src/features/git-monitor/hooks/useGitStatus.ts` - staleTime 25초 설정

#### 중복 코드 제거 (Phase 3)

- `frontend/src/lib/utils.ts` - truncatePath, formatTokens, sortSessionsByStatus 추가
- `frontend/src/features/session/components/Sidebar.tsx` - 로컬 truncatePath 제거
- `frontend/src/features/session/components/SessionDashboardCard.tsx` - 로컬 truncatePath 제거
- `frontend/src/features/git-monitor/components/GitRepoSelector.tsx` - 로컬 truncatePath 제거
- `frontend/src/features/chat/components/MessageBubble.tsx` - 로컬 formatTokens 제거
- `frontend/src/features/session/components/SessionStatsBar.tsx` - 로컬 formatTokens 제거
- `frontend/src/features/chat/components/ContextWindowBar.tsx` - 로컬 formatTokens 제거
- `frontend/src/features/chat/components/PlanResultCard.tsx` - 로컬 formatTokens 제거
- `frontend/src/routes/index.tsx` - sortSessionsByStatus 사용
- `frontend/src/features/command-palette/hooks/useCommandPalette.ts` - useSessions().deleteSession 사용

#### ChatPanel 분해 (Phase 4)

- `frontend/src/features/chat/components/ChatPanel.tsx` - 683줄 → 478줄 (30% 감소)
- `frontend/src/features/chat/components/ChatHeader.tsx` - IIFE → useMemo, ModelSelector 로직 흡수

#### 렌더 최적화 (Phase 5)

- `frontend/src/features/chat/components/ActivityStatusBar.tsx` - React.memo 적용
- `frontend/src/features/chat/components/SlashCommandPopup.tsx` - React.memo 적용
- `frontend/src/features/files/components/FilePanel.tsx` - React.memo 적용
- `frontend/src/features/usage/components/UsageFooter.tsx` - React.memo 적용
- `frontend/src/features/session/components/SessionSettings.tsx` - useCallback 추가
- `frontend/src/routes/__root.tsx` - DashboardGrid memo, SplitViewPane 컴포넌트 추출, sortSessionsByStatus

## 상세 변경 내용

### Phase 1: 에러 처리 강화 및 타입 안전성 개선

- 전역 ErrorBoundary로 앱 크래시 시 graceful fallback UI 제공
- `.catch(() => {})` 패턴을 `.catch(() => toast.error(...))` 로 변경
- TanStack Query Mutation에 onError 콜백 추가 (MCP, 글로벌 설정)
- `as any` 3개 제거 → 적절한 타입 캐스트 적용
- SessionStats 인터페이스를 4개 파일에서 1개 공유 타입으로 통합

### Phase 2: ApiClient 재설계

- `AbortController` 기반 30초 타임아웃 적용
- `config.API_BASE_URL` 환경 설정 연동
- `getBlob()`, `postFormData()` 메서드 추가로 raw fetch 패턴 제거
- Git status 쿼리 staleTime 25초 설정으로 불필요한 재요청 방지

### Phase 3: 공유 유틸리티 추출 및 중복 코드 제거

- `truncatePath` (3개 파일), `formatTokens` (4개 파일), `sortSessionsByStatus` (2개 파일) 공유화
- `useCommandPalette`의 직접 API 호출을 `useSessions().deleteSession`으로 통합

### Phase 4: ChatPanel 분해

- 683줄 모놀리식 컴포넌트를 3개 훅 + 1개 컴포넌트로 분해 (30% 감소)
  - `useChatNotifications` — 상태 전환/에러/권한 알림 + 캐시 동기화
  - `useChatSearch` — 검색 상태, 매치, 키보드 단축키
  - `usePlanActions` — Plan 모드 5개 콜백
  - `ChatSearchBar` — 메모이즈된 검색 UI

### Phase 5: 렌더 최적화

- 5개 leaf 컴포넌트에 `React.memo` 적용
- `SplitViewPane` 추출로 `.map()` 내 인라인 클로저 제거
- `SessionSettings`에 `useCallback` 추가

### Phase 6: Dead code 정리

- `useDesktopNotification.ts` 삭제 (import 0개)
- `ModelSelector.tsx` 삭제 (부작용 전용 → ChatHeader로 로직 이동)
- `w-[7px] h-[7px]` → `w-2 h-2` (4px 그리드 준수)

## 검증 결과

- TypeScript 타입 검사: 에러 0개 (`npx tsc -p tsconfig.app.json --noEmit`)
- 프로덕션 빌드: 성공 (`pnpm build`, 26초)

## 비고

- 35개 파일 변경 (549 추가, 509 삭제)
- 순수 프론트엔드 리팩터링으로 백엔드 변경 없음
