# 작업 이력: 프론트엔드 코드 단순화 6단계 리팩토링

- **날짜**: 2026-02-26
- **작업자**: Claude + 사용자
- **브랜치**: main

## 변경 요약

프론트엔드 코드베이스의 중복 패턴, 거대 파일, 타입 중복을 6단계에 걸쳐 체계적으로 리팩토링했습니다. 기존 기능 100% 보존하면서 약 1,500줄 감소 및 유지보수성 향상을 달성했습니다.

## 변경 파일 목록

### Frontend - 신규 파일

- `frontend/src/types/shared-fields.ts` - TokenFields, ToolResultFields 공유 인터페이스
- `frontend/src/features/chat/components/ToolMessageShell.tsx` - 도구 메시지 공통 래퍼 컴포넌트
- `frontend/src/features/chat/components/ResultMessage.tsx` - 결과 메시지 컴포넌트 (MessageBubble에서 추출)
- `frontend/src/features/chat/components/AssistantText.tsx` - 어시스턴트 텍스트 컴포넌트 (MessageBubble에서 추출)
- `frontend/src/lib/hooks/useOptimisticMutation.ts` - TanStack Query optimistic update 헬퍼 훅
- `frontend/src/features/chat/hooks/reducers/types.ts` - 리듀서 타입 정의
- `frontend/src/features/chat/hooks/reducers/connectionHandlers.ts` - 연결 관련 리듀서 핸들러
- `frontend/src/features/chat/hooks/reducers/wsMessageHandlers.ts` - WebSocket 메시지 리듀서 핸들러
- `frontend/src/features/chat/hooks/reducers/workflowHandlers.ts` - 워크플로우 리듀서 핸들러
- `frontend/src/features/chat/hooks/reducers/uiHandlers.ts` - UI 액션 리듀서 핸들러
- `frontend/src/features/chat/hooks/reducers/index.ts` - 리듀서 디스패처 + barrel export
- `frontend/src/features/chat/hooks/useChatArtifact.ts` - 아티팩트 뷰어 상태/콜백 훅
- `frontend/src/features/chat/hooks/useChatSessionActions.ts` - 세션 관리 액션 훅

### Frontend - 수정 파일

- `frontend/src/types/message.ts` - TokenFields, ToolResultFields 확장으로 중복 필드 제거
- `frontend/src/types/ws-events.ts` - TokenFields, ToolResultFields 확장으로 중복 필드 제거
- `frontend/src/types/index.ts` - shared-fields re-export 추가
- `frontend/src/features/chat/components/BashToolMessage.tsx` - ToolMessageShell 사용으로 래퍼 코드 제거
- `frontend/src/features/chat/components/ReadToolMessage.tsx` - ToolMessageShell 사용으로 래퍼 코드 제거
- `frontend/src/features/chat/components/EditToolMessage.tsx` - ToolMessageShell 사용으로 래퍼 코드 제거
- `frontend/src/features/chat/components/SearchToolMessage.tsx` - ToolMessageShell 사용으로 래퍼 코드 제거
- `frontend/src/features/chat/components/WebToolMessage.tsx` - ToolMessageShell 사용으로 래퍼 코드 제거
- `frontend/src/features/chat/components/toolMessageUtils.ts` - getToolSummary, formatModelName 이동
- `frontend/src/features/chat/components/MessageBubble.tsx` - ResultMessage, AssistantText 추출 (605→480줄)
- `frontend/src/features/chat/hooks/claudeSocketReducer.ts` - reducers/ 디렉토리 re-export shim으로 변환
- `frontend/src/lib/api/client.ts` - request() 메서드에 parseResponse 파라미터 추가로 중복 제거
- `frontend/src/features/session/hooks/useSessions.ts` - useOptimisticMutation 적용
- `frontend/src/features/tags/hooks/useTags.ts` - useOptimisticMutation 적용
- `frontend/src/features/chat/components/ChatPanel.tsx` - useChatArtifact, useChatSessionActions 훅 적용 (660→573줄)

## 상세 변경 내용

### 1. Phase 5: 타입 통합 (shared-fields.ts)

- ws-events.ts와 message.ts 간 중복되던 토큰 필드(input_tokens, output_tokens 등)와 도구 결과 필드(tool_use_id, output 등)를 공유 인터페이스로 추출
- 각 타입이 공유 인터페이스를 extends하여 단일 소스로 관리

### 2. Phase 1: ToolMessageShell 추출

- 6개 도구 메시지 컴포넌트(Bash, Read, Edit, Search, Web + generic)가 반복하던 Collapsible + borderColor + useElapsed + ToolStatusIcon 패턴을 단일 래퍼 컴포넌트로 캡슐화
- 각 도구 컴포넌트는 고유 로직(파싱, 렌더링)만 유지

### 3. Phase 2: API 클라이언트 + Optimistic Mutation 헬퍼

- ApiClient의 getText/getBlob/postFormData가 request()의 fetch+timeout 로직을 각각 복제하던 것을 parseResponse 파라미터 추가로 1줄 위임으로 변환
- useOptimisticMutation 훅으로 4개 파일의 onMutate/onError/onSettled 보일러플레이트 통합

### 4. Phase 3: Reducer 분할

- 982줄 단일 switch문(38개 case)을 4개 핸들러 파일 + 150줄 디스패처로 분할
- Set 기반 타입 라우팅으로 connection/workflow/ui 핸들러 디스패치, 나머지는 wsMessage 핸들러로 전달
- 기존 import 경로 호환을 위한 re-export shim 유지

### 5. Phase 4: MessageBubble 분해

- ResultMessage(토큰/비용 메타데이터 표시)와 AssistantText(마크다운+스트리밍 인디케이터)를 별도 파일로 추출
- getToolSummary, formatModelName을 toolMessageUtils.ts로 이동

### 6. Phase 6: ChatPanel 오케스트레이션 단순화

- 아티팩트 뷰어 상태 및 주석/편집 콜백을 useChatArtifact 훅으로 추출
- 세션 관리 액션(삭제, 아카이브, 워크트리, 포크)을 useChatSessionActions 훅으로 추출

## 테스트 방법

```bash
cd frontend
npx tsc -p tsconfig.app.json --noEmit  # TypeScript 타입 검사
pnpm build                              # 프로덕션 빌드
```

실행 중인 세션에서 다음 확인:
- 각 도구 메시지(Bash, Read, Edit, Search, Web) 렌더링
- 세션 삭제/아카이브, 태그 삭제에서 optimistic update
- 채팅 세션: 연결/재연결, 메시지 전송, 도구 사용, 워크플로우, 퍼미션
- 아티팩트 뷰어: 주석 추가/해결/삭제

## 비고

- pre-existing 타입 에러 `useWorkflowActions.ts(94,46)` 존재 (이번 리팩토링과 무관)
- 모든 변경은 프론트엔드에 한정, 백엔드 수정 없음
- 순 감소: 약 1,500줄 (464 추가 / 1,957 삭제)
