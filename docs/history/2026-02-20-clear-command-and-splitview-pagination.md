# 작업 이력: /clear 명령어 개선 및 Split View 페이징

- **날짜**: 2026-02-20
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

1. `/clear` 명령어를 CLI 전달 방식에서 WebSocket 기반 서버 처리로 변경하여 안정성 개선
2. Split View 모드에 5개 단위 페이징 기능을 추가하여 6개 이상의 세션도 접근 가능하게 개선

## 변경 파일 목록

### Backend

- `backend/app/api/v1/endpoints/ws.py` - `_handle_clear` 핸들러 추가 (claude_session_id 초기화)

### Frontend

- `frontend/src/features/chat/components/ChatPanel.tsx` - /clear 시 CLI 전달 제거, 도움말 텍스트 수정
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - clearMessages에서 WebSocket clear 메시지 전송
- `frontend/src/routes/__root.tsx` - Split View 페이징 로직 + SplitViewPagination 컴포넌트 추가

## 상세 변경 내용

### 1. /clear 명령어 WebSocket 기반으로 변경

- **기존**: `/clear` → `sendPrompt("/clear")` → Claude CLI에 전달 → CLI가 처리
- **변경**: `/clear` → WebSocket `{ type: "clear" }` 메시지 → 서버에서 `claude_session_id` 초기화
- 서버 `_handle_clear` 함수가 `session_manager.update_claude_session_id(session_id, "")` 호출
- 초기화 후 `system` 이벤트로 "대화 컨텍스트가 초기화되었습니다" 브로드캐스트
- 다음 프롬프트에서 자연스럽게 새 대화가 시작됨

### 2. Split View 페이징 기능

- `SPLIT_PAGE_SIZE = 5` 상수로 페이지 크기 정의
- `splitPage` 로컬 state + `totalSplitPages` 계산
- `pagedSessions` = `activeSessions.slice(page * 5, (page + 1) * 5)`
- 페이지 범위 자동 보정: 세션 삭제/아카이브로 페이지 초과 시 마지막 페이지로 이동
- 포커스 자동 이동: 페이지 전환 시 focusedSessionId가 현재 페이지에 없으면 첫 번째 세션으로
- `SplitViewPagination` 컴포넌트: `◀ 1/3 ▶` 형태, 기존 "+N more" 배지 위치 대체
- 세션 5개 이하일 때는 페이지네이션 UI 미표시 (기존과 동일 동작)

## 관련 커밋

- `<hash>` - Fix: /clear 명령어 WebSocket 기반 서버 처리로 변경
- `<hash>` - Feat: Split View 페이징 기능 추가

## 테스트 방법

### /clear 명령어
1. 세션에서 대화 진행
2. `/clear` 입력
3. 메시지 목록 초기화 + "대화 컨텍스트가 초기화되었습니다" 시스템 메시지 확인
4. 다음 프롬프트가 새 대화로 시작되는지 확인

### Split View 페이징
1. 6개 이상의 세션 생성
2. Split View 모드 활성화
3. 우상단 `◀ 1/2 ▶` 페이지 네비게이션으로 페이지 전환
4. 첫 페이지/마지막 페이지에서 비활성화된 버튼 확인
5. 세션 삭제 후 페이지 범위 자동 보정 확인
