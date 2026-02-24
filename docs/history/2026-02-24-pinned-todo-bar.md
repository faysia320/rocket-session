# 작업 이력: TodoWrite 메시지를 고정 바로 표시 (Pinned Todo Bar)

- **날짜**: 2026-02-24
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

TodoWrite 메시지를 채팅 메시지 스트림에서 분리하여, ChatHeader 아래 고정 바(PinnedTodoBar)로 표시하도록 변경했습니다. TodoWrite 재호출 시 기존 바가 업데이트되어 채팅이 깔끔하게 유지됩니다.

## 변경 파일 목록

### Frontend

- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - TodoItem 타입 export, pinnedTodos 상태 추가, WS_TOOL_USE에서 TodoWrite 인터셉트, WS_SESSION_STATE 히스토리 재빌드 시 TodoWrite 필터링/복원, CLEAR_MESSAGES 리셋
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - 반환 객체에 pinnedTodos 추가
- `frontend/src/features/chat/components/PinnedTodoBar.tsx` - 신규 Collapsible 바 컴포넌트
- `frontend/src/features/chat/components/ChatPanel.tsx` - PinnedTodoBar import 및 레이아웃 배치
- `frontend/src/features/chat/components/MessageBubble.tsx` - TodoWrite 방어 처리 (return null), 미사용 import 제거

## 상세 변경 내용

### 1. claudeSocketReducer — pinnedTodos 상태 관리

- `TodoItem` 인터페이스를 export하여 PinnedTodoBar에서 재사용
- `ClaudeSocketState`에 `pinnedTodos: TodoItem[]` 필드 추가
- `WS_TOOL_USE`: TodoWrite 도구 호출 시 messages 배열에 추가하지 않고 pinnedTodos만 갱신
- `WS_SESSION_STATE`: 히스토리 재빌드 시 TodoWrite 메시지를 필터링하고 마지막 TodoWrite의 todos를 pinnedTodos로 복원
- `CLEAR_MESSAGES`: pinnedTodos를 빈 배열로 초기화

### 2. PinnedTodoBar 컴포넌트 (신규)

- shadcn/ui Collapsible 사용
- 접힌 상태: Todo 아이콘 + 진행률(completed/total) + 상태 도트(completed/in_progress/pending)
- 펼친 상태: TodoWriteMessage와 동일한 스타일의 항목별 아이콘/텍스트
- todos가 빈 배열이면 null 반환 (숨김)

### 3. MessageBubble — TodoWrite 방어 처리

- TodoWrite가 messages에 들어오지 않지만 안전을 위해 `return null` 처리
- 미사용 TodoWriteMessage import 제거

## 테스트 방법

1. 세션에서 Claude가 TodoWrite 호출 시 → 채팅 목록에 안 뜨고 PinnedTodoBar에 표시
2. TodoWrite 재호출 시 → 바가 새 내용으로 갱신
3. 바 클릭 시 펼침/접힘 동작
4. /clear 시 PinnedTodoBar 초기화
5. 세션 전환 후 복귀 시 히스토리에서 pinnedTodos 복원
