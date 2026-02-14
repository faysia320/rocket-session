# 작업 이력: 모바일 퍼스트 반응형 + 로딩 UX 일관성

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

데스크톱 전용으로 개발된 대시보드를 모바일 퍼스트 반응형으로 개편하고, 로딩/에러 상태 처리의 일관성을 확보했습니다. 375px 모바일부터 1280px 데스크톱까지 3단계 브레이크포인트 전략을 적용합니다.

## 변경 파일 목록

### Frontend - 신규

- `frontend/src/hooks/useMediaQuery.ts` - useIsMobile/useIsDesktop 반응형 훅

### Frontend - 수정

- `frontend/src/store/useSessionStore.ts` - sidebarMobileOpen 상태 추가
- `frontend/src/routes/__root.tsx` - 모바일 Sheet / 데스크톱 인라인 Sidebar 분기
- `frontend/src/features/session/components/Sidebar.tsx` - 모바일 오버레이 + 로딩 Skeleton
- `frontend/src/features/chat/components/ChatHeader.tsx` - 햄버거 버튼 + 정보 반응형 숨김
- `frontend/src/features/chat/components/ChatPanel.tsx` - setSidebarMobileOpen 연결
- `frontend/src/routes/index.tsx` - 홈 화면 모바일 햄버거 버튼
- `frontend/src/features/chat/components/ChatInput.tsx` - 힌트 텍스트 반응형
- `frontend/src/features/usage/components/UsageFooter.tsx` - 상세 정보 반응형 숨김
- `frontend/src/features/session/hooks/useSessions.ts` - 낙관적 업데이트 + 에러 토스트

## 상세 변경 내용

### 1. 브레이크포인트 전략 (3단계)

| 화면 | 범위 | Sidebar | UsageFooter |
|------|------|---------|-------------|
| 모바일 | < 768px | Sheet 오버레이 | 브랜드만 |
| 태블릿 | 768-1023px | 인라인 (접기 가능) | 좌측 상세 |
| 데스크톱 | >= 1024px | 인라인 펼침 | 전체 표시 |

### 2. useMediaQuery 훅

- `window.matchMedia` 기반 실시간 반응
- `useIsMobile()`: < 768px, `useIsDesktop()`: >= 1024px
- SSR 안전 (초기값 false)

### 3. 모바일 Sidebar (Sheet 오버레이)

- Zustand에 `sidebarMobileOpen` 상태 추가
- `__root.tsx`에서 모바일 시 shadcn Sheet으로 Sidebar 래핑
- 세션 선택/생성 시 Sheet 자동 닫힘
- `isMobileOverlay` prop으로 Split View/접기 버튼 숨김

### 4. ChatHeader 반응형

- 모바일에서 햄버거 버튼 표시 (md:hidden)
- workDir, gitBranch 정보 모바일에서 숨김 (hidden md:contents)
- FilePanel Popover 너비 반응형 (w-[calc(100vw-2rem)] md:w-[560px])

### 5. 로딩 UX 일관성

- useSessions에서 isLoading, isError 반환
- deleteMutation/renameMutation에 낙관적 업데이트 적용
- 에러 시 toast 알림 + 이전 데이터 롤백
- Sidebar에 로딩 Skeleton + 에러 메시지

## 테스트 방법

1. `cd frontend && pnpm build` - 빌드 검증
2. 브라우저 DevTools에서 반응형 모드로 375px, 768px, 1280px 확인
3. 모바일에서 햄버거 버튼 → Sheet 열림/닫힘 확인
4. 세션 삭제 시 낙관적 업데이트 (즉시 UI 반영) 확인

## 비고

- Playwright MCP 브라우저로 E2E 검증 완료 (모바일/태블릿/데스크톱)
- 기존 데스크톱 레이아웃에 영향 없음 (하위 호환)
