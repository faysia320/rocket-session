# 작업 이력: Plan 모드, 채팅 가상화, 사이드바 접기

- **날짜**: 2026-02-13
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

1. Plan 모드 기능 추가 (읽기 전용 분석 모드)
2. 채팅 메시지 가상화 스크롤 + 도구 실행 상태 표시
3. 사이드바 접기/펼치기(Collapse) 기능
4. 유니코드 이스케이프 문자를 리터럴로 통일

## 변경 파일 목록

### Backend

- `backend/app/core/database.py` - sessions 테이블에 mode 컬럼 추가 + 마이그레이션
- `backend/app/schemas/session.py` - mode 필드 추가 (Create/Update/Info)
- `backend/app/services/session_manager.py` - mode 필드 전달
- `backend/app/services/claude_runner.py` - Plan 모드 시스템 프롬프트 주입, tool_result/tool_use_id 이벤트 파싱
- `backend/app/api/v1/endpoints/sessions.py` - update에 mode 전달
- `backend/app/api/v1/endpoints/ws.py` - WebSocket에서 mode 처리

### Frontend

- `frontend/src/types/session.ts` - SessionMode 타입 추가
- `frontend/src/types/message.ts` - id, tool_use_id, output, status, tool_result 타입 추가
- `frontend/src/types/index.ts` - SessionMode export
- `frontend/package.json` / `pnpm-lock.yaml` - @tanstack/react-virtual 추가
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - 메시지 ID 생성, tool_result 핸들링, activeTools 상태
- `frontend/src/features/chat/components/ChatPanel.tsx` - 가상화 스크롤, Plan 모드 전환 UI, ActivityStatusBar
- `frontend/src/features/chat/components/MessageBubble.tsx` - memo 최적화, 도구 상태 아이콘, output 표시
- `frontend/src/features/chat/components/ActivityStatusBar.tsx` - 새 파일: 활성 도구 상태 바
- `frontend/src/store/useSessionStore.ts` - sidebarCollapsed, toggleSidebar 추가
- `frontend/src/features/session/components/Sidebar.tsx` - 접기/펼치기 UI (64px ↔ 260px)
- `frontend/src/routes/__root.tsx` - main 영역 transition 추가
- `frontend/src/features/session/components/SessionSettings.tsx` - 유니코드 이스케이프 수정
- `frontend/src/features/session/components/SessionSetupPanel.tsx` - 유니코드 이스케이프 수정

## 상세 변경 내용

### 1. Plan 모드

- `SessionMode = 'normal' | 'plan'` 타입 추가
- Plan 모드 활성화 시 시스템 프롬프트로 "파일 변경 금지, 분석만 수행" 지시 주입
- 허용 도구를 읽기 전용(Read, Glob, Grep 등)으로 제한
- Shift+Tab 키보드 단축키로 모드 전환
- 입력창에 "Plan" 배지 표시

### 2. 채팅 가상화 + 도구 실행 상태

- @tanstack/react-virtual로 메시지 목록 가상화 (대량 메시지 성능 개선)
- 각 메시지에 고유 ID 부여 (virtualizer key 안정성)
- MessageBubble을 memo로 감싸 불필요한 리렌더 방지
- tool_use 메시지에 running/done/error 상태 표시
- tool_result 이벤트로 도구 실행 결과(output) 표시
- ActivityStatusBar로 현재 실행 중인 도구 목록 표시

### 3. 사이드바 접기(Collapse)

- Zustand 스토어에 sidebarCollapsed 상태 추가
- 펼친 상태(260px) ↔ 접힌 상태(64px) 토글
- 접힌 상태: 로고 아이콘, + 버튼(Tooltip), 상태 도트(Tooltip으로 세션 정보), ThemeToggle만 표시
- PanelLeftClose/PanelLeftOpen 아이콘으로 토글
- transition-[width,min-width] duration-200 애니메이션

### 4. 유니코드 이스케이프 정리

- `\u25C6` → `◆`, `\u2026` → `…`, `\u00B7` → `·` 등 리터럴 문자로 통일

## 테스트 방법

1. Plan 모드: Shift+Tab으로 모드 전환 → "Plan" 배지 확인 → 프롬프트 전송 시 읽기 전용 동작 확인
2. 채팅 가상화: 다수의 메시지가 있는 세션에서 스크롤 성능 확인
3. 도구 상태: Claude 실행 중 도구 아이콘이 spinning → 체크/X 마크로 전환 확인
4. 사이드바: 토글 버튼 클릭 → 260px ↔ 64px 전환, 접힌 상태에서 Tooltip 확인
