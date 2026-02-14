# 작업 이력: AskUserQuestion 인터랙티브 UI 구현

- **날짜**: 2026-02-14
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

Claude Code CLI가 `AskUserQuestion` 도구를 사용할 때, 기존에는 일반 tool_use 카드로만 표시되던 것을 인터랙티브 선택 UI로 개선했습니다. 사용자가 옵션을 선택하면 답변이 다음 프롬프트에 자동으로 포함됩니다.

## 변경 파일 목록

### Backend

- `backend/app/models/event_types.py` - `ASK_USER_QUESTION` 이벤트 타입 상수 추가
- `backend/app/services/claude_runner.py` - AskUserQuestion tool_use 감지 및 전용 이벤트 변환, tool_result 필터링
- `backend/app/services/jsonl_watcher.py` - 동일 감지 로직 (JSONL 파일 감시용)

### Frontend

- `frontend/src/types/message.ts` - `AskUserQuestionOption`, `AskUserQuestionItem`, `AskUserQuestionMsg` 타입 추가, Message union 및 WebSocketEventType 확장
- `frontend/src/types/index.ts` - 새 타입 re-export
- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - `ask_user_question` 핸들러, `answerQuestion`/`confirmAnswers` 콜백, `sendPrompt` 답변 자동 prefix, `pendingAnswerCount`
- `frontend/src/features/chat/components/AskUserQuestionCard.tsx` - **신규** 인라인 질문 카드 컴포넌트
- `frontend/src/features/chat/components/MessageBubble.tsx` - `ask_user_question` case 및 콜백 props 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - 콜백 연결 및 pendingAnswerCount 전달
- `frontend/src/features/chat/components/ChatInput.tsx` - 답변 인디케이터 표시

## 상세 변경 내용

### 1. 데이터 흐름

```
Claude CLI (tool_use: AskUserQuestion)
  -> claude_runner.py: 감지 -> ask_user_question 이벤트 변환
  -> WebSocket -> useClaudeSocket: 메시지 배열에 추가
  -> AskUserQuestionCard: 인라인 렌더링 (라디오/체크박스)
  -> 사용자 답변 선택 -> 확인 클릭
  -> 다음 sendPrompt 호출 시 답변 자동 prefix
```

### 2. Backend: 이벤트 감지 및 변환

- `claude_runner.py`와 `jsonl_watcher.py`에서 `AskUserQuestion` tool_use를 감지
- 전용 `ask_user_question` WebSocket 이벤트로 변환 (questions, tool_use_id 포함)
- tool_result는 프론트엔드에 전송하지 않음 (ExitPlanMode와 동일 패턴)

### 3. Frontend: 인터랙티브 카드 컴포넌트

- 단일 선택: 커스텀 라디오 버튼 스타일
- 다중 선택: shadcn/ui Checkbox 활용
- Other(자유입력) 옵션 지원
- 답변 완료 시 "answered"/"sent" 배지 + 비활성화
- 기존 ToolUseMessage border-l 스타일 패턴 참조

### 4. Frontend: 답변 자동 전송

- `sendPrompt` 래핑: 미전송 답변을 `[이전 질문에 대한 답변]` prefix로 자동 포함
- ChatInput에 "N개 답변이 다음 메시지에 포함됩니다" 인디케이터 표시
- 전송 후 sent 플래그로 중복 전송 방지

## 제약사항

CLI가 `-p --output-format stream-json` 헤드리스 모드로 실행되어 stdin으로 tool_result를 보낼 수 없으므로, 사용자 답변은 다음 프롬프트에 자동 포함하는 방식으로 처리합니다.

## 테스트 방법

1. Plan mode에서 Claude가 AskUserQuestion을 호출하는 세션 실행
2. 인라인 질문 카드가 메시지 스트림에 표시되는지 확인
3. 옵션 선택 후 "confirm" 클릭
4. ChatInput에 답변 인디케이터가 나타나는지 확인
5. 다음 메시지 전송 시 답변이 prefix로 포함되는지 확인
