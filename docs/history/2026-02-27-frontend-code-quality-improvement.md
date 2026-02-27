# 작업 이력: Frontend 코드 품질 개선

- **날짜**: 2026-02-27
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

프론트엔드 코드베이스의 성능 최적화, 구조 안정화, 디자인 시스템 준수를 위한 5개 Batch 개선 작업을 수행했습니다.

## 변경 파일 목록

### Frontend

- `frontend/tailwind.config.js` - border-bright 색상 토큰 + 시맨틱 shadow 토큰 등록
- `frontend/src/features/workspace/hooks/useWorkspaces.ts` - 조건부 폴링으로 전환
- `frontend/src/features/team/hooks/useTeamMessages.ts` - 무조건 폴링 제거
- `frontend/src/features/workflow/components/WorkflowProgressBar.tsx` - useMemo 적용
- `frontend/src/features/chat/components/ChatPanel.tsx` - sessionKeys.all로 쿼리 키 통일
- `frontend/src/features/chat/hooks/useChatSessionActions.ts` - sessionKeys.all로 쿼리 키 통일
- `frontend/src/features/chat/components/MessageBubble.tsx` - useCallback 안정화 + shadow-card 토큰
- `frontend/src/features/session/components/Sidebar.tsx` - border-border-bright + size-7
- `frontend/src/features/team/components/TeamSidebar.tsx` - border-border-bright
- `frontend/src/features/team/components/TeamSidebarGroup.tsx` - border-border-bright
- `frontend/src/features/analytics/components/ChartCard.tsx` - border-border-bright/40 + shadow-card
- `frontend/src/features/analytics/components/TokenSummaryCards.tsx` - shadow-card
- `frontend/src/features/session/components/SessionDashboardCard.tsx` - shadow-card-hover
- `frontend/src/features/chat/components/SlashCommandPopup.tsx` - shadow-dropdown
- `frontend/src/features/chat/components/ChatSearchBar.tsx` - text-lg
- `frontend/src/features/chat/components/ChatMessageList.tsx` - text-4xl

## 상세 변경 내용

### 1. Batch 1: 조건부 폴링 (성능, 네트워크 절감)

- `useWorkspaces`: 무조건 5초 폴링 → cloning/deleting 상태일 때만 폴링 (함수형 refetchInterval)
- `useWorkspace`: 무조건 3초 폴링 → cloning/deleting 상태일 때만 폴링
- `useTeamMessages`: 무조건 10초 폴링 제거 → staleTime 30초 + refetchOnWindowFocus

### 2. Batch 2: useMemo 추가 + 쿼리 키 통일

- `WorkflowProgressBar`: sortedSteps, orderedNames에 useMemo 적용 (매 렌더마다 sort+map 방지)
- `ChatPanel`, `useChatSessionActions`: raw `["sessions"]` → `sessionKeys.all` 팩토리 사용

### 3. Batch 3: MessageBubble 인라인 람다 안정화

- onOpenArtifact, onRetryError 인라인 람다 → useCallback으로 안정화
- memo 감싸진 컴포넌트의 memo 효과 무력화 방지

### 4. Batch 4: 디자인 토큰 등록 + 적용

- tailwind.config.js에 border-bright 색상 토큰 등록 → `border-border-bright` 클래스 사용 가능
- 시맨틱 shadow 토큰 등록 (card, card-hover, dropdown, modal, tooltip)
- 7개 파일에서 verbose `border-[hsl(var(--border-bright))]` → `border-border-bright` 교체
- 4개 파일에서 shadow-sm/md/lg → shadow-card/card-hover/dropdown 교체

### 5. Batch 5: 비표준 크기 클래스 정규화

- `text-[16px]` → `text-lg` (디자인 토큰 스케일의 1rem = 16px)
- `text-[32px]` → `text-4xl` (1.875rem ≈ 30px, 가장 근접한 토큰)
- `h-[30px] w-[30px]` → `size-7` (28px, 같은 파일 내 footer 버튼과 일관)

## 테스트 방법

```bash
cd frontend && npx tsc -p tsconfig.app.json --noEmit  # 타입 검사
cd frontend && pnpm build                              # 프로덕션 빌드
```

## 비고

- echarts 관련 타입/빌드 에러는 기존 이슈 (패키지 미설치 상태)
- 빌드 검증 완료 (echarts 설치 후 빌드 성공)
