# 작업 이력: AskUserQuestion 일시정지 및 자동전송 개선

- **날짜**: 2026-02-19
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

AskUserQuestion(인터랙티브 질문) 기능의 두 가지 핵심 문제를 해결:
1. CLI subprocess가 질문 후 멈추지 않고 계속 실행되는 문제 → subprocess 종료로 해결
2. 답변 전송에 추가 텍스트 입력이 필요한 문제 → 확인 버튼 클릭 시 자동 전송으로 해결

## 변경 파일 목록

### Backend

- `backend/app/services/claude_runner.py` - AskUserQuestion 감지 시 subprocess 종료 로직 추가

### Frontend

- `frontend/src/features/chat/hooks/useClaudeSocket.ts` - confirmAndSendAnswers 함수 및 skipAnswerPrepend 옵션 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - confirmAndSendAnswers 연결
- `frontend/src/features/chat/components/ChatInput.tsx` - 답변만으로 Send 가능하도록 조건 수정

## 상세 변경 내용

### 1. CLI subprocess 종료 (문제 1 해결)

- `_handle_assistant_event`에서 AskUserQuestion 감지 시 `turn_state["should_terminate"] = True` 설정
- `_parse_stream`에서 이벤트 처리 후 `should_terminate` 플래그 확인 → `break`으로 루프 탈출
- `_parse_stream` 반환 타입을 `None` → `dict`로 변경하여 `turn_state` 반환
- `run()` 메서드에서 `should_terminate` 시 `process.terminate()`으로 subprocess 종료, stderr 읽기 건너뜀
- 사용자가 답변하면 기존 `--resume` 메커니즘으로 대화 재개

### 2. 확인 버튼 자동 전송 (문제 2 해결)

- `sendPrompt`에 `skipAnswerPrepend` 옵션 추가 (자동 답변 prepend 건너뛰기)
- `confirmAndSendAnswers` 함수 신규 추가: 답변 확정 + messagesRef에서 답변 텍스트 직접 구성 + 즉시 전송
- ChatPanel에서 `onConfirmAnswers`를 `confirmAndSendAnswers`로 교체
- ChatInput Send 버튼 비활성 조건에 `pendingAnswerCount` 고려 (폴백)

## 테스트 방법

1. 세션에서 Claude에게 선택형 질문을 유도하는 프롬프트 전송
2. AskUserQuestionCard 표시 후 세션이 idle 상태로 전환되는지 확인
3. 카드에서 답변 선택 후 "확인" 클릭 → 답변이 자동 전송되고 세션 재개 확인
4. Permission 모드, Plan 모드가 영향받지 않는지 확인
