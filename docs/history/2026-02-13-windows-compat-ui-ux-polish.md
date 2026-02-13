# 작업 이력: Windows 호환성 및 UI/UX 개선

- **날짜**: 2026-02-13
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Backend에서 Windows 환경의 subprocess 실행 호환성을 확보하고, Frontend에서 텍스트 선택 UX와 사이드바 스타일을 개선했습니다.

## 변경 파일 목록

### Backend

- `backend/app/services/claude_runner.py` - Windows용 AsyncProcessWrapper 추가

### Frontend

- `frontend/src/features/chat/components/ChatPanel.tsx` - 메시지 영역 텍스트 선택 허용
- `frontend/src/features/chat/components/MessageBubble.tsx` - 메시지 버블 텍스트 선택 허용
- `frontend/src/features/session/components/Sidebar.tsx` - 사이드바 색상 시스템 변경
- `frontend/src/features/usage/components/UsageFooter.tsx` - 사이드바 색상 시스템 적용
- `frontend/src/index.css` - 선택 색상 및 사이드바 CSS 변수 조정

## 상세 변경 내용

### 1. Windows subprocess 호환성 (Backend)

- `_AsyncStreamReader`: Windows subprocess 파이프를 `asyncio.to_thread`로 비동기 읽기
- `_AsyncProcessWrapper`: `subprocess.Popen`을 `asyncio.Process` 인터페이스로 감싸는 래퍼
- Windows(`sys.platform == "win32"`)에서는 `subprocess.Popen` + 래퍼, 그 외에서는 기존 `asyncio.create_subprocess_exec` 사용
- 이유: Windows에서 `asyncio.create_subprocess_exec`가 `ProactorEventLoop` 제약으로 불안정

### 2. 텍스트 선택 UX 개선 (Frontend)

- ChatPanel 메시지 영역, UserMessage, AssistantText, ResultMessage, ToolUseMessage에 `select-text` 클래스 추가
- `::selection` 색상을 `bg-primary`와 겹치지 않도록 변경:
  - Light 모드: 파스텔 블루 (`hsl(220 76% 82%)`)
  - Dark 모드: info 블루 (`hsl(var(--info))`)

### 3. 사이드바 스타일 개선 (Frontend)

- Sidebar: `bg-card` → `bg-sidebar`, `border-border` → `border-sidebar-border`, `h-screen` → `h-full`
- UsageFooter: 동일하게 sidebar 전용 색상 토큰 적용
- CSS 변수 조정:
  - Light `--sidebar-background`: `220 22% 92%` → `224 22% 87%` (약간 어둡게)
  - Dark `--sidebar-background`: `220 37% 7%` → `222 40% 11%` (약간 밝게, 본문과 구분)

## 테스트 방법

1. Windows 환경에서 백엔드 서버 실행 후 Claude 세션 시작 → subprocess 정상 동작 확인
2. 채팅 메시지 텍스트 드래그 선택 → 선택 색상이 primary와 겹치지 않는지 확인
3. 사이드바가 본문 배경과 미묘하게 구분되는지 확인 (light/dark 모드 모두)
