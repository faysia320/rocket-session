# 작업 이력: /clear DB 삭제 + Git Monitor 다중 저장소 + UI 개선

- **날짜**: 2026-02-20
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

1. `/clear` 명령어가 DB 기록(메시지/파일변경/이벤트)까지 삭제하도록 개선
2. Git Monitor를 단일 저장소에서 다중 저장소(최대 10개) 모니터링으로 확장
3. UsageFooter 모바일 라벨 축약 + ChatInput 모드 토글 border 스타일 수정

## 변경 파일 목록

### Backend

- `backend/app/api/v1/endpoints/ws.py` - _handle_clear에 DB 삭제 + 이벤트 버퍼 리셋 추가
- `backend/app/core/database.py` - delete_messages, delete_file_changes 메서드 추가
- `backend/app/models/event_types.py` - SYSTEM 이벤트 타입 추가
- `backend/app/services/session_manager.py` - clear_history 메서드 추가

### Frontend

- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - CLEAR_MESSAGES에 tokenUsage 초기화 추가
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - system 이벤트 핸들러 추가
- `frontend/src/features/chat/components/ChatInput.tsx` - 모드 토글 버튼 border 스타일
- `frontend/src/features/git-monitor/components/GitMonitorPanel.tsx` - 다중 저장소 UI로 리팩토링
- `frontend/src/features/git-monitor/components/GitRepoSelector.tsx` - 삭제 (다중 저장소로 대체)
- `frontend/src/features/git-monitor/components/GitMonitorRepoSection.tsx` - 신규 (개별 저장소 섹션)
- `frontend/src/features/usage/components/UsageFooter.tsx` - 모바일 라벨 축약 (5시간→h, 주간→w)
- `frontend/src/store/useSessionStore.ts` - gitMonitorPath → gitMonitorPaths 배열 + migrate

## 상세 변경 내용

### 1. /clear 명령어 DB 기록 삭제

- 기존: claude_session_id만 초기화
- 변경: messages, file_changes, events 테이블에서 해당 세션 데이터 삭제
- WebSocketManager.reset_session으로 인메모리 이벤트 버퍼 + seq 카운터 초기화
- broadcast_event 대신 broadcast로 직접 알림 (reset 후이므로)

### 2. Git Monitor 다중 저장소

- `gitMonitorPath: string` → `gitMonitorPaths: string[]` (최대 10개)
- Zustand persist version 1로 마이그레이션 (기존 단일 경로 → 배열)
- GitMonitorRepoSection 컴포넌트로 각 저장소를 아코디언 형태로 표시
- GitRepoSelector 삭제, DirectoryBrowser로 저장소 추가

### 3. UsageFooter 모바일 축약

- `md` 미만: "5시간" → "h", "주간" → "w"
- `whitespace-nowrap`으로 줄바꿈 방지

### 4. ChatInput 모드 토글 border

- border 클래스를 공통으로 분리, plan 모드일 때 border-primary/30, normal 모드일 때 border-transparent
