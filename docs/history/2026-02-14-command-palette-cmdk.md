# 작업 이력: 커맨드 팔레트 (Cmd+K) 기능 추가

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

VS Code 스타일의 커맨드 팔레트를 추가하여 ⌘K (Mac) / Ctrl+K (Win/Linux)로 모든 기능에 빠르게 접근할 수 있도록 구현했습니다. cmdk 라이브러리 + shadcn/ui Command 컴포넌트를 사용하며, 5개 카테고리(내비게이션, 세션, 채팅, UI, Git)로 ~20개 명령어를 제공합니다.

## 변경 파일 목록

### Frontend - 신규 파일

- `frontend/src/components/ui/command.tsx` - shadcn/ui Command 래퍼 컴포넌트 (cmdk 기반)
- `frontend/src/features/command-palette/types.ts` - PaletteCommand, CommandCategory, CommandContext 타입 정의
- `frontend/src/features/command-palette/registry.ts` - RuntimeContext 기반 명령어 컨텍스트 필터링
- `frontend/src/features/command-palette/commands/navigation.ts` - 내비게이션 명령어 (홈, 새 세션, 세션 빠른 전환)
- `frontend/src/features/command-palette/commands/session.ts` - 세션 명령어 (중지, 삭제, 이름 변경, 내보내기, 터미널)
- `frontend/src/features/command-palette/commands/chat.ts` - 채팅 명령어 (초기화, 검색, 모드 전환, compact, model, 설정, 파일)
- `frontend/src/features/command-palette/commands/ui.ts` - UI 토글 명령어 (사이드바, 분할뷰, 대시보드, 테마)
- `frontend/src/features/command-palette/commands/git.ts` - Git 명령어 (커밋, PR 생성, rebase)
- `frontend/src/features/command-palette/commands/index.ts` - barrel export
- `frontend/src/features/command-palette/hooks/useGlobalShortcuts.ts` - ⌘K + ⌘B 글로벌 키보드 단축키 리스너
- `frontend/src/features/command-palette/hooks/useCommandPalette.ts` - 명령어 조율 + 컨텍스트 필터링 + 그룹핑
- `frontend/src/features/command-palette/components/CommandPalette.tsx` - 팔레트 UI (카테고리별 그룹 + 최근 사용)
- `frontend/src/features/command-palette/components/CommandPaletteProvider.tsx` - 루트 레이아웃 마운트용 프로바이더
- `frontend/src/store/useCommandPaletteStore.ts` - Zustand 스토어 (열림/닫힘, 최근 명령어 5개 persist)

### Frontend - 수정 파일

- `frontend/package.json` - cmdk 1.1.1 의존성 추가
- `frontend/pnpm-lock.yaml` - lockfile 업데이트
- `frontend/src/routes/__root.tsx` - CommandPaletteProvider 마운트 (2줄 추가)
- `frontend/src/store/index.ts` - useCommandPaletteStore export 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - CustomEvent 리스너 7개 추가 (~28줄)

## 상세 변경 내용

### 1. 아키텍처 설계

- **팩토리 패턴**: 5개 카테고리별 팩토리 함수가 의존성을 주입받아 PaletteCommand[] 반환
- **컨텍스트 필터링**: RuntimeContext(activeSessionId, sessionStatus, isGitRepo)로 사용 불가능한 명령어 자동 숨김
- **CustomEvent 통신**: ChatPanel 내부 액션(clearMessages, toggleSearch, cycleMode, sendPrompt)은 이벤트 버스로 연결하여 기존 아키텍처 변경 최소화

### 2. 글로벌 단축키

- ⌘K / Ctrl+K → 커맨드 팔레트 토글
- ⌘B / Ctrl+B → 사이드바 토글 (보너스)
- `useGlobalShortcuts` 훅으로 루트 레이아웃에서 1회 등록

### 3. 최근 사용 추적

- Zustand persist 미들웨어로 최근 5개 명령어 ID를 localStorage에 저장
- 팔레트 상단 "최근 사용" 그룹에 표시

### 4. 명령어 목록 (~20개)

| 카테고리 | 명령어 | 비고 |
|---------|--------|------|
| 내비게이션 | 홈 이동, 새 세션 생성, 세션 빠른 전환 | 세션 목록 동적 생성 |
| 세션 | 중지, 삭제, 이름 변경, 내보내기, 터미널 | 활성 세션 필요 |
| 채팅 | 초기화, 검색, 모드 전환, compact, model, 설정, 파일 | CustomEvent 위임 |
| UI | 사이드바, 분할뷰, 대시보드, 테마 | 상태 반영 동적 레이블 |
| Git | 커밋, PR 생성, rebase | Git 저장소 필요 |

## 관련 커밋

- `f1a923c` - Feat: Add 커맨드 팔레트 (⌘K) 기능

## 테스트 방법

1. ⌘K → 팔레트 열림, Escape → 닫힘
2. 한국어/영어 검색어로 명령어 필터링 ("홈", "home", "세션", "sidebar" 등)
3. 홈에서는 세션/채팅/Git 명령어 숨김 확인
4. 세션 내에서 "메시지 초기화", "모드 전환" 등 실행 확인
5. "다크/라이트 모드 전환" 실행 → 테마 변경 확인
6. 최근 사용 명령어 팔레트 상단 표시 확인

## 비고

- TypeScript 타입 검사 통과 (`npx tsc --noEmit`)
- 프로덕션 빌드 성공 (`pnpm build`)
- 다크/라이트 테마 모두 시맨틱 Tailwind 토큰 사용으로 자동 호환
