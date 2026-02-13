# 작업 이력: 스크롤 수정 + 재연결 + 안정성 개선

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

File Changes Popover 스크롤 문제 수정, 계정 ID 사용량 표시 지원, result 텍스트 폴백 처리, 채팅 검색 하이라이트, WebSocket 재연결 버튼, 프론트엔드 안정성 개선을 수행했습니다.

## 변경 파일 목록

### Backend

- `backend/.env.example` - CLAUDE_ACCOUNT_ID 환경변수 추가
- `backend/app/core/config.py` - claude_account_id 설정 필드 추가
- `backend/app/schemas/usage.py` - UsageInfo에 account_id 필드 추가
- `backend/app/services/usage_service.py` - account_id 설정값 전달
- `backend/app/services/claude_runner.py` - result 텍스트 누락 시 스트리밍 텍스트 폴백

### Frontend

- `frontend/src/features/chat/components/ChatHeader.tsx` - 재연결 Retry 버튼 + PopoverContent 스크롤 수정
- `frontend/src/features/chat/components/ChatInput.tsx` - 이미지 크기 제한(10MB) + URL 메모리 해제
- `frontend/src/features/chat/components/ChatPanel.tsx` - reconnect prop + searchQuery 전달
- `frontend/src/features/chat/components/MessageBubble.tsx` - 검색어 하이라이트 지원
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - reconnect 함수 + result 텍스트 보존
- `frontend/src/features/files/components/FilePanel.tsx` - 파일 리스트/diff 스크롤 수정
- `frontend/src/features/files/components/FileViewer.tsx` - 에러 핸들링 개선
- `frontend/src/features/session/components/SessionSettings.tsx` - toast 알림 추가
- `frontend/src/lib/api/sessions.api.ts` - export 다운로드 try/finally 안정성
- `frontend/src/lib/utils.ts` - highlightText 함수 추가

## 상세 변경 내용

### 1. 계정 ID 사용량 표시 지원

- Backend 설정에 CLAUDE_ACCOUNT_ID 환경변수 추가
- UsageInfo 스키마에 account_id 필드 추가하여 프론트엔드에 전달

### 2. result 텍스트 폴백 처리

- claude_runner에서 result 이벤트의 텍스트가 비어있을 때 스트리밍된 텍스트를 폴백으로 사용
- 프론트엔드에서도 result 메시지에 텍스트가 없으면 이전 assistant_text를 보존

### 3. 채팅 검색 하이라이트 + 재연결 버튼

- highlightText 유틸 함수 추가 (검색어를 mark 태그로 하이라이트)
- UserMessage, ErrorMessage, SystemMessage에 searchQuery 하이라이트 적용
- WebSocket 연결 실패 시 Retry 버튼 표시 + reconnect 함수 추가

### 4. File Changes Popover 스크롤 수정

- PopoverContent에 max-h-[70vh] + flex flex-col 추가
- FilePanel 파일 리스트 ScrollArea에서 max-h-[400px] 제거, flex-1 min-h-0 사용
- Diff 영역 ScrollArea를 네이티브 overflow-auto div로 교체

### 5. 프론트엔드 안정성 개선

- ChatInput: 이미지 10MB 크기 제한, URL.revokeObjectURL 메모리 해제
- FileViewer: 콘텐츠와 diff 모두 실패 시 에러 메시지 표시
- SessionSettings: 설정 로드/저장 시 toast 알림 추가
- sessions.api: export 다운로드 시 try/finally로 DOM 정리 보장

## 테스트 방법

1. File Changes popover에서 10개 이상 파일 시 스크롤 확인
2. 파일 클릭 → diff 영역 스크롤 확인
3. WebSocket 끊김 → Retry 버튼 → 재연결 확인
4. 채팅 검색 시 하이라이트 표시 확인
5. 10MB 초과 이미지 업로드 시 에러 메시지 확인
