# 작업 이력: 채팅 카드 디자인 개선 및 Plan 파일 content 추출

- **날짜**: 2026-02-19
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

채팅 인터페이스의 시각적 일관성을 개선했습니다. Claude 텍스트 메시지(AssistantText, ResultMessage)에 카드 스타일을 적용하여 도구 메시지(Bash, Edit, Todo)와의 이질감을 해소하고, Plan 모드에서 plan 파일의 실제 content를 추출하여 렌더링하는 기능을 추가했습니다. 추가로 채팅 영역의 overflow 문제, 모바일 입력 줌 방지, 기타 UI 마이크로 개선을 수행했습니다.

## 변경 파일 목록

### Frontend - Plan 파일 content 추출

- `frontend/src/features/chat/utils/planFileExtractor.ts` - Plan 모드의 Write tool_use에서 plan 파일 content를 추출하는 유틸리티 (신규)
- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - result 메시지 처리 시 planFileContent 추출 로직 추가
- `frontend/src/types/message.ts` - ResultMsg에 planFileContent 필드 추가, getMessageText에 반영
- `frontend/src/features/chat/components/PlanResultCard.tsx` - planFileContent 우선 렌더링 + 버튼 반응형 레이아웃

### Frontend - Claude 텍스트 카드 디자인

- `frontend/src/features/chat/components/MessageBubble.tsx` - AssistantText/ResultMessage에 bg-card/50 카드 스타일 적용, ToolUseMessage overflow 수정

### Frontend - Overflow 수정

- `frontend/src/components/ui/CodeBlock.tsx` - min-w-0 max-w-full overflow-hidden 추가
- `frontend/src/components/ui/MarkdownRenderer.tsx` - inline code에 break-all 추가
- `frontend/src/features/chat/components/ChatPanel.tsx` - ScrollArea overflow-x-hidden, 메시지 래퍼 min-w-0

### Frontend - UI 마이크로 개선

- `frontend/src/features/chat/components/ChatInput.tsx` - 모바일 줌 방지 (text-[16px])
- `frontend/src/features/chat/components/ChatHeader.tsx` - 파일 변경 배지에 고유 파일 수 표시
- `frontend/src/features/chat/components/SlashCommandPopup.tsx` - ScrollArea viewportClassName 추가
- `frontend/src/features/session/components/Sidebar.tsx` - 상태 필터 라벨 축약 (Running→Run 등)

## 상세 변경 내용

### 1. Plan 파일 content 추출

- Plan 모드 result에서 Write tool_use 메시지의 content를 추출하여 planFileContent로 저장
- PlanResultCard에서 planFileContent가 있으면 이를 우선 렌더링하고, result text는 하단에 보조 표시
- 버튼 영역에 flex-wrap + shrink-0 적용으로 좁은 너비에서 찌그러짐 방지

### 2. Claude 텍스트 카드 디자인

- AssistantText: `pl-3 border-l-2 border-info/50` → `px-3.5 py-3 bg-card/50 rounded-lg border-l-[3px]`
- ResultMessage: 동일 패턴 적용 + 에러 시 `bg-destructive/5` 배경 색조
- 도구 카드(`bg-card` solid + 전체 border)보다 가벼운 시각적 위계 유지

### 3. Overflow 수정

- CodeBlock, MarkdownRenderer, ChatPanel, ToolUseMessage에 overflow 방지 클래스 추가
- 긴 코드 블록이나 인라인 코드가 채팅 영역을 넘치지 않도록 처리

### 4. UI 마이크로 개선

- 모바일에서 input focus 시 브라우저 자동 줌 방지 (font-size 16px)
- 파일 변경 배지: 중복 파일 제거 후 고유 파일 수만 표시
- SlashCommandPopup ScrollArea 높이 제약 수정
- Sidebar 상태 필터 라벨을 짧게 축약

## 테스트 방법

1. `cd frontend && npx vite build` - 빌드 에러 없음 확인
2. 브라우저에서 채팅 인터페이스 확인:
   - Claude 텍스트가 카드 형태로 보이는지
   - 도구 카드보다 시각적으로 가벼운지
   - Plan 모드 결과 카드에서 plan 파일 content가 우선 렌더링되는지
   - 버튼이 좁은 너비에서 줄바꿈되는지
   - 긴 코드가 overflow 없이 표시되는지
