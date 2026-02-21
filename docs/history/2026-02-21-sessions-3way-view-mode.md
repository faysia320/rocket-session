# 작업 이력: Sessions 3-Way View Mode 통합

- **날짜**: 2026-02-21
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Dashboard를 별도 메뉴에서 제거하고 Sessions의 3가지 뷰 모드(Dashboard / Single / Split) 중 하나로 통합했습니다. 이제 Sessions가 앱의 기본 진입점이며, 사이드바 하단의 뷰 스위처로 모드를 전환합니다.

## 변경 파일 목록

### Frontend - 상태 관리

- `frontend/src/store/useSessionStore.ts` - `splitView: boolean` → `viewMode: ViewMode` 교체, persist v2→v3 마이그레이션
- `frontend/src/store/useSessionStore.test.ts` - viewMode 기반 테스트로 업데이트

### Frontend - 라우팅/레이아웃

- `frontend/src/routes/__root.tsx` - 사이드바 `/`에서도 표시, split 조건을 viewMode 기반으로 변경
- `frontend/src/routes/session/$sessionId.tsx` - dashboard→single 자동 전환 useEffect 추가
- `frontend/src/features/layout/components/GlobalTopBar.tsx` - Dashboard nav 제거, Sessions가 `/`로 이동

### Frontend - UI 컴포넌트

- `frontend/src/features/session/components/Sidebar.tsx` - Footer에 3-way 뷰 스위처 (LayoutGrid / MessageSquare / Columns2)
- `frontend/src/features/chat/components/ChatPanel.tsx` - `splitView` → `isSplitView` 교체
- `frontend/src/features/chat/hooks/useChatSearch.ts` - `splitView` → `isSplitView` 교체

### Frontend - 명령 팔레트

- `frontend/src/features/command-palette/commands/ui.ts` - 분할뷰 토글 → 3개 뷰 모드 명령
- `frontend/src/features/command-palette/commands/navigation.ts` - "대시보드" → "세션 홈" 라벨 변경
- `frontend/src/features/command-palette/hooks/useCommandPalette.ts` - viewMode/setViewMode 참조로 교체

## 상세 변경 내용

### 1. Zustand Store 리팩터링

- `splitView: boolean` → `viewMode: 'dashboard' | 'single' | 'split'` enum으로 교체
- `ViewMode` 타입 export 추가
- `setSplitView`/`toggleSplitView` → `setViewMode(mode)` 단일 메서드
- persist 마이그레이션 v2→v3: `splitView: true` → `viewMode: 'split'`, `splitView: false` → `viewMode: 'dashboard'`

### 2. 네비게이션 구조 변경

- GlobalTopBar의 NAV_ITEMS에서 Dashboard 항목 제거
- Sessions 항목이 `/`(세션 홈)로 직접 이동하며 `viewMode`를 `dashboard`로 설정
- Sessions 탭 활성 판별: `pathname === "/" || pathname.startsWith("/session")`
- 사이드바 토글 버튼이 `/`에서도 표시

### 3. 뷰 모드 전환 동작

- Dashboard → Single: 세션 카드 클릭 → `$sessionId.tsx` useEffect에서 자동 전환
- 뷰 스위처: 사이드바 하단 3개 아이콘 버튼 (활성 모드에 bg-muted 하이라이트)
- Dashboard 버튼 클릭 시 `navigate({ to: "/" })` + `setViewMode('dashboard')`

### 4. 명령 팔레트 업데이트

- 기존 "분할 뷰 전환" 1개 명령 → "대시보드 뷰", "단일 뷰", "분할 뷰" 3개 명령
- 네비게이션 "대시보드" → "세션 홈"으로 라벨 변경

## 테스트 방법

1. 앱 시작 시 Sessions 탭 활성 + 사이드바 표시 확인
2. 사이드바 하단 뷰 스위처로 3가지 모드 전환
3. 세션 카드 클릭 → Single View 자동 전환
4. Split View 페이징 정상 동작
5. Ctrl+K 명령 팔레트에서 3개 뷰 모드 명령 확인
6. localStorage 마이그레이션 (기존 splitView → viewMode)
