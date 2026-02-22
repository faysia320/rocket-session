# 작업 이력: 풀스택 성능 최적화

- **날짜**: 2026-02-22
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Backend DB 쿼리 최적화, Frontend 렌더링 성능 개선, Lazy Loading 코드 분할, 컴포넌트 메모이제이션 등 전반적인 성능 최적화를 수행했습니다.

## 변경 파일 목록

### Backend (11개 파일)

- `backend/app/api/v1/endpoints/sessions.py` - exists() 경량 쿼리 사용
- `backend/app/api/v1/endpoints/ws.py` - idle/error 시 DB fallback 조회 스킵
- `backend/app/repositories/analytics_repo.py` - ROW_NUMBER → DISTINCT ON 단순화
- `backend/app/repositories/search_repo.py` - COUNT(*) OVER() 윈도우 함수 + correlated subquery
- `backend/app/repositories/session_repo.py` - exists/get_status/get_mode 경량 쿼리 + correlated subquery
- `backend/app/repositories/settings_repo.py` - 문서 정리
- `backend/app/services/filesystem_service.py` - OrderedDict LRU 캐시 + lock 보호
- `backend/app/services/local_session_scanner.py` - JSON 파싱 최적화 (불필요한 json.loads 회피)
- `backend/app/services/session_manager.py` - JSONB 필드 불필요한 json.loads 제거
- `backend/app/services/settings_service.py` - update 후 엔티티 직접 반환 (추가 SELECT 제거)
- `backend/app/services/template_service.py` - import 시 이름 중복 체크 단일 쿼리화

### Frontend (17개 파일)

- `frontend/src/components/ui/CodeBlock.tsx` - memo 래핑
- `frontend/src/features/chat/components/ChatHeader.tsx` - opus 강제 설정 제거
- `frontend/src/features/chat/components/ChatPanel.tsx` - RAF throttle scroll + animateFromIndex
- `frontend/src/features/chat/components/MessageBubble.tsx` - 조건부 애니메이션 (animate prop)
- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - pendingAnswerCount O(1), 중복 이벤트 방지, 역방향 탐색
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - useMemo → reducer state 사용
- `frontend/src/features/command-palette/components/CommandPaletteProvider.tsx` - lazy load
- `frontend/src/features/dashboard/components/DashboardGrid.tsx` - useMemo 추가
- `frontend/src/features/directory/hooks/useGitInfo.ts` - 불필요한 debounce 제거
- `frontend/src/features/history/components/HistoryPage.tsx` - useRef 디바운스 + memo 행
- `frontend/src/features/layout/components/GlobalTopBar.tsx` - lazy load GlobalSettingsDialog + useCallback
- `frontend/src/features/session/components/Sidebar.tsx` - transition-all → transition-colors
- `frontend/src/features/settings/components/GlobalSettingsDialog.tsx` - controlled component화
- `frontend/src/lib/utils.ts` - highlightText regex lastIndex 버그 수정
- `frontend/src/routes/__root.tsx` - SessionLayout 분리 (리렌더 격리)
- `frontend/src/routes/history.tsx` - lazy load HistoryPage
- `frontend/src/routes/index.tsx` - 캐시 전용 읽기 (staleTime: Infinity)

## 상세 변경 내용

### 1. Backend DB 쿼리 최적화

- **Correlated subquery**: session_repo, search_repo에서 LEFT OUTER JOIN + GROUP BY 서브쿼리를 correlated scalar subquery로 교체. 데이터가 작을 때 JOIN 대비 간결하고, PostgreSQL 옵티마이저가 잘 처리
- **COUNT(*) OVER()**: search_repo에서 별도 count 쿼리를 윈도우 함수로 통합하여 DB 라운드트립 1회 절감
- **DISTINCT ON**: analytics_repo에서 ROW_NUMBER 3단계 서브쿼리를 PostgreSQL DISTINCT ON으로 단순화
- **경량 쿼리**: session_repo에 exists(), get_status(), get_mode() 추가 — 전체 엔티티 로드 없이 필요한 컬럼만 조회

### 2. Backend 서비스 최적화

- **WS 연결 시간 단축**: idle/error 상태에서 current_turn_events DB fallback 조회를 스킵
- **settings_service**: update 후 별도 get() 대신 UPDATE로 반환된 엔티티를 직접 변환
- **filesystem_service**: dict → OrderedDict로 LRU 캐시 구현 (O(1) 퇴거), 사용 중 lock 보호
- **local_session_scanner**: needs_timestamp/needs_meta 사전 판별로 불필요한 json.loads 호출 회피
- **session_manager**: JSONB 필드가 PostgreSQL에서 항상 Python 객체로 반환되므로 json.loads fallback 제거

### 3. Frontend 채팅 렌더링 최적화

- **animate prop**: 가상화 스크롤에서 뷰포트에 재진입하는 메시지에 불필요한 fadeIn/slideIn 애니메이션 비활성화
- **RAF throttle**: ChatPanel 스크롤 핸들러를 requestAnimationFrame으로 쓰로틀링
- **pendingAnswerCount**: useMemo(O(n) 매번 계산) → reducer state에서 O(1) delta 추적
- **중복 이벤트 방지**: assistant_text가 동일하면 배열 복사 건너뛰기
- **WS_STOPPED 최적화**: 전체 messages.map 대신 역방향 탐색으로 현재 턴만 검색
- **CodeBlock memo**: 동일 props 시 리렌더 방지

### 4. Frontend 코드 분할 + Lazy Loading

- **CommandPalette**: 대화상자가 열릴 때만 lazy load
- **GlobalSettingsDialog**: controlled component로 변환 + 열릴 때만 lazy load
- **HistoryPage**: 라우트 진입 시 lazy load
- **SessionLayout 분리**: RootComponent에서 useSessions() 구독을 SessionLayout으로 격리 → GlobalTopBar, CommandPalette 리렌더 방지
- **IndexPage**: staleTime: Infinity로 캐시 전용 읽기 (부모가 이미 폴링)

### 5. Frontend 기타 성능 개선

- **DashboardGrid**: sortSessionsByStatus, runningCount에 useMemo 적용
- **HistoryPage**: useState 타이머 → useRef 타이머 (불필요한 리렌더 제거), HistorySessionRow를 memo로 래핑
- **Sidebar**: transition-all → transition-colors (GPU 레이어 최소화)
- **useGitInfo**: 클라이언트 debounce 제거 (서버 캐시 10초 TTL 활용)
- **highlightText**: regex g 플래그 lastIndex 버그 수정

## 관련 커밋

- Backend 쿼리/서비스 최적화
- Frontend 채팅 렌더링 최적화
- Frontend Lazy Loading + 코드 분할
- Frontend 컴포넌트 성능 개선

## 테스트 방법

1. 세션 목록 페이지에서 세션 목록 로딩 속도 확인
2. 채팅 화면에서 메시지 스트리밍 시 스크롤 부드러움 확인
3. History/CommandPalette 최초 진입 시 lazy loading 동작 확인
4. 세션 전환 시 불필요한 리렌더 없는지 React DevTools로 확인
