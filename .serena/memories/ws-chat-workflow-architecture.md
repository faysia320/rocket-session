# Claude Code CLI WebSocket + Chat + Workflow 아키텍처

## 1. 관련 파일 및 함수 목록

### Backend (Python/FastAPI)

| 파일 | 핵심 함수/클래스 | 역할 |
|------|----------------|------|
| `backend/app/api/v1/endpoints/ws.py` | `websocket_endpoint()`, `_handle_prompt()`, `_handle_stop()`, `_handle_clear()`, `_handle_permission_respond()`, `_LRULocks` | WS 엔드포인트, 메시지 라우팅, 프롬프트 실행 |
| `backend/app/services/websocket_manager.py` | `WebSocketManager.broadcast_event()`, `broadcast()`, `_batch_writer_loop()`, `_flush_events()`, `_heartbeat_loop()`, `get_buffered_events_after()`, `get_current_turn_events()` | 연결 레지스트리, 이벤트 버퍼링, DB 배치 저장, heartbeat |
| `backend/app/services/claude_runner.py` | `ClaudeRunner.run()`, `_build_command()`, `_handle_stream_event()`, `_handle_workflow_completion()` | CLI 서브프로세스 실행, stream-json 파싱, 워크플로우 체이닝 |
| `backend/app/services/workflow_service.py` | `WorkflowService.resolve_workflow_state()`, `build_phase_context()`, `approve_phase()`, `request_revision()`, `parse_qa_checklist()` | 워크플로우 게이트, 컨텍스트 구성, 아티팩트 관리 |
| `backend/app/services/workflow_definition_service.py` | CRUD, `get_or_default()` | 워크플로우 정의 관리 |
| `backend/app/models/event_types.py` | `WsEventType` | 25+ 이벤트 타입 상수 |
| `backend/app/services/session_manager.py` | `SessionManager.get()`, `update_settings()`, `add_message()`, `get_history()` | 세션 CRUD, 메시지 영속화 |

### Frontend (React/TypeScript)

| 파일 | 핵심 함수/컴포넌트 | 역할 |
|------|-------------------|------|
| `frontend/src/features/chat/hooks/useClaudeSocket.ts` (~730줄) | `useClaudeSocket()`, `handleMessage()`, `connect()`, visibility 핸들링 | WS 연결 관리, 메시지 수신/파싱/디스패치, 재연결 |
| `frontend/src/features/chat/hooks/useClaudeSocket.utils.ts` | `getWsUrl()`, `getBackoffDelay()`, `generateMessageId()` | URL 구성, 지수 백오프, ID 생성 |
| `frontend/src/features/chat/hooks/reducers/types.ts` (~215줄) | `ClaudeSocketState`, `ClaudeSocketAction`, `ReconnectState`, `TokenUsage` | 상태/액션 타입 정의 |
| `frontend/src/features/chat/hooks/reducers/wsMessageHandlers.ts` (~565줄) | `handleWsMessage()` — 18개 케이스 | WS 메시지→상태 변환 리듀서 |
| `frontend/src/features/chat/hooks/reducers/workflowHandlers.ts` (~85줄) | `handleWorkflow()` — 5개 케이스 | 워크플로우 상태 전이 리듀서 |
| `frontend/src/features/chat/hooks/reducers/connectionHandlers.ts` | 연결 상태 리듀서 | 재연결 상태 관리 |
| `frontend/src/features/chat/hooks/reducers/uiHandlers.ts` | UI 액션 리듀서 | 답변, 메시지 클리어, 트렁케이트 |
| `frontend/src/features/chat/components/ChatPanel.tsx` (~580줄) | `ChatPanel` (memo) | 메인 오케스트레이터 — WS훅, 가상 스크롤, 워크플로우 통합 |
| `frontend/src/features/chat/components/ChatMessageList.tsx` (~150줄) | `ChatMessageList` (memo) | 가상 스크롤 컨테이너, ErrorBoundary 래핑 |
| `frontend/src/features/chat/components/MessageBubble.tsx` (~494줄) | `MessageBubble` (memo) | 메시지 타입별 컴포넌트 디스패치 |
| `frontend/src/features/chat/components/AssistantText.tsx` | `AssistantText` | 마크다운 스트리밍 렌더링 |
| `frontend/src/features/chat/components/ResultMessage.tsx` | `ResultMessage` | 결과 메시지 + 토큰 사용량 |
| `frontend/src/features/chat/components/*ToolMessage.tsx` (5종) | Edit, Bash, Read, Search, Web ToolMessage | 도구별 전용 UI |
| `frontend/src/features/chat/components/AskUserQuestionCard.tsx` | `AskUserQuestionCard` | 인터랙티브 질문/응답 UI |
| `frontend/src/features/chat/components/PermissionDialog.tsx` | `PermissionDialog` | 권한 요청 다이얼로그 |
| `frontend/src/features/chat/components/PinnedTodoBar.tsx` | `PinnedTodoBar` | TodoWrite 고정 바 |
| `frontend/src/features/chat/components/ActivityStatusBar.tsx` | `ActivityStatusBar` (aria-live) | 실시간 도구 활동 표시 |
| `frontend/src/features/workflow/components/WorkflowProgressBar.tsx` | `WorkflowProgressBar` | 워크플로우 단계 프로그레스 바 |
| `frontend/src/features/workflow/components/WorkflowPhaseCard.tsx` | `WorkflowPhaseCard` | 단계 완료 카드 (승인/수정 요청) |
| `frontend/src/features/workflow/components/ArtifactViewer.tsx` | `ArtifactViewer` | 아티팩트 마크다운 뷰어 + 주석 |
| `frontend/src/features/workflow/hooks/useWorkflow.ts` | `useWorkflowStatus()`, `useWorkflowArtifacts()`, `workflowKeys` | TanStack Query 워크플로우 API |
| `frontend/src/features/workflow/hooks/useWorkflowActions.ts` | `useWorkflowActions()` | 승인/수정/아티팩트 열기 오케스트레이션 |
| `frontend/src/types/ws-events.ts` (~291줄) | 25+ WsEvent 타입 union | WS 이벤트 타입 정의 |
| `frontend/src/types/message.ts` (~233줄) | `Message` union type | 메시지 타입 정의 |

---

## 2. 동작 방식 및 데이터 흐름

### 2.1 전체 데이터 흐름

```
[사용자 입력]
    ↓ WS send: {type: "prompt", prompt, allowed_tools, images}
[Backend ws.py]
    ↓ _handle_prompt() → 세션 로드, 워크플로우 게이트, Lock 획득
    ↓ manager.add_message() → DB 저장
    ↓ ws_manager.broadcast_event(USER_MESSAGE)
    ↓ asyncio.create_task(runner.run())
[ClaudeRunner]
    ↓ _build_command() → claude -p <prompt> --output-format stream-json --verbose
    ↓ subprocess stdout → stream-json 라인 파싱
    ↓ _handle_stream_event() → ws_manager.broadcast_event()
[WebSocketManager]
    ↓ _next_seq() → 단조 증가 시퀀스 부여
    ↓ 인메모리 deque 버퍼 저장 (max 1000)
    ↓ asyncio.Queue → 배치 writer → DB (COPY/INSERT)
    ↓ fire-and-forget broadcast → 모든 연결된 WS 클라이언트
[Frontend useClaudeSocket]
    ↓ ws.onmessage → JSON.parse → handleMessage()
    ↓ seq 중복 체크 (lastSeqRef 단조 증가)
    ↓ switch(data.type) → dispatch({type: "WS_*", ...})
    ↓ assistant_text: RAF 배치 (프레임당 1회)
[claudeSocketReducer]
    ↓ wsMessageHandlers / workflowHandlers / connectionHandlers / uiHandlers
    ↓ 불변 상태 업데이트
[React 렌더링]
    ↓ ChatPanel (memo) → useVirtualizer → ChatMessageList (memo)
    ↓ MessageBubble (memo) → 타입별 전용 컴포넌트
```

### 2.2 재연결 흐름

```
[WS 끊김]
    ↓ ws.onclose → reconnectAttempt++
    ↓ 지수 백오프: min(1000 × 2^attempt, 30000) × jitter(0.8~1.2)
    ↓ new WebSocket(getWsUrl(sessionId, lastSeqRef.current))
[Backend]
    ↓ last_seq 쿼리 파라미터 → is_reconnect=true
    ↓ 세션 상태만 전송 (히스토리 없음)
    ↓ ws_manager.get_buffered_events_after(last_seq) → missed_events 전송
[Frontend]
    ↓ "session_state" (is_reconnect=true) → 상태 유지, sessionInfo 갱신
    ↓ "missed_events" → 순차 재생 via handleMessage()
    ↓ reconnectAttempt = 0 (성공)
```

### 2.3 세션 전환/새로고침 흐름 (Initial Load)

```
[최초 연결 (last_seq 없음)]
    ↓ Backend: 전체 history + file_changes + current_turn_events + pending_interactions
[Frontend handleMessage("session_state")]
    ↓ history → tool_result를 tool_use_id로 인덱싱 → 병합된 messages 배열 구성
    ↓ TodoWrite 필터링 → pinnedTodos 설정
    ↓ 토큰 집계 (inputTokens, outputTokens, cache*)
    ↓ pending_interactions.permission → pendingPermission
    ↓ pending_interactions.ask_user_question → WS_ASK_USER_QUESTION dispatch
    ↓ current_turn_events 순차 재생
    ↓ latest_seq 업데이트
```

### 2.4 워크플로우 실행 흐름

```
[사용자 프롬프트 (워크플로우 활성 세션)]
    ↓ _handle_prompt() → workflow_service.resolve_workflow_state()
    ↓ 워크플로우 게이트: awaiting_approval이면 거부
    ↓ build_phase_context() → 템플릿 치환 ({user_prompt}, {previous_artifact})
    ↓ _build_command(): constraints="readonly" → --permission-mode plan + READONLY_TOOLS
    ↓ runner.run() → Claude CLI 실행
    ↓ 완료: _handle_workflow_completion()
    ↓ create_artifact() → DB 저장
    ↓ broadcast: WORKFLOW_PHASE_COMPLETED or WORKFLOW_AUTO_CHAIN
[Frontend]
    ↓ WS_WORKFLOW_PHASE_COMPLETED → sessionInfo.workflow_phase_status = "awaiting_approval"
    ↓ WorkflowPhaseCard 렌더링 (승인/수정 요청 버튼)
    ↓ 사용자 승인 → useApprovePhase mutation → POST /approve
    ↓ Backend: approve_phase() → 다음 단계 자동 체이닝
    ↓ WS_WORKFLOW_PHASE_APPROVED → sessionInfo.workflow_phase 갱신
```

### 2.5 WS 이벤트 기반 캐시 무효화 (workflow_artifact_updated / workflow_annotation_added)

```
[Backend: 아티팩트/주석 생성·수정]
    ↓ broadcast: workflow_artifact_updated / workflow_annotation_added
[Frontend useClaudeSocket.handleMessage]
    ↓ workflowDataChangedRef.current() 콜백 호출
[ChatPanel useEffect]
    ↓ queryClient.invalidateQueries(workflowKeys.artifacts(sessionId))
    ↓ queryClient.invalidateQueries(workflowKeys.artifact(sessionId, artifactId))
```

---

## 3. 아키텍처 및 환경

### 3.1 기술 스택

| 계층 | 기술 |
|------|------|
| **Backend** | Python 3.x, FastAPI, asyncio, asyncpg, SQLAlchemy (async) |
| **Frontend** | React 18.3.1, TypeScript, Vite 6.x |
| **상태 관리** | useReducer (WS 상태), Zustand (클라이언트 영속 상태), TanStack Query (서버 상태) |
| **라우팅** | TanStack Router (파일 기반) |
| **UI 라이브러리** | Radix UI (headless), Tailwind CSS 3.4.x, Lucide Icons |
| **가상 스크롤** | @tanstack/react-virtual |
| **마크다운** | react-markdown + remark-gfm + rehype-highlight |
| **테마** | next-themes (다크모드), HSL 기반 Catppuccin 팔레트 |
| **패키지 관리** | pnpm |

### 3.2 아키텍처 패턴

1. **이벤트 드리븐 아키텍처**: Backend → WS broadcast → Frontend reducer
2. **Fire-and-Forget Broadcasting**: `asyncio.create_task(broadcast())` — stdout 논블로킹
3. **듀얼 버퍼 시스템**: 인메모리 deque(1000) + DB 배치 writer(COPY/INSERT)
4. **시퀀스 기반 이벤트 복구**: 단조 증가 seq → reconnect 시 missed_events 조회
5. **Reducer 기반 상태 관리**: 18개 WS + 5개 워크플로우 + 7개 UI 액션 타입
6. **컴포넌트 경계 메모이제이션**: ChatPanel → ChatMessageList → MessageBubble 모두 `memo()`
7. **RAF 배치 최적화**: assistant_text 스트리밍을 프레임당 1회로 throttle
8. **Orphaned Result 버퍼**: tool_result가 tool_use보다 먼저 도착하는 레이스 컨디션 처리 (max 20)
9. **콜백 ref 패턴**: WS 이벤트 → TanStack Query invalidation (리렌더 없이 사이드 이펙트 실행)
10. **전략적 코드 스플리팅**: ChatPanel, TeamSidebar, MemoPanel, GlobalSettingsDialog 지연 로딩

### 3.3 의존성 관계

```
ws.py ──→ SessionManager (세션 CRUD)
      ├─→ WebSocketManager (브로드캐스트)
      ├─→ ClaudeRunner (CLI 실행)
      ├─→ WorkflowService (워크플로우 게이트/컨텍스트)
      └─→ McpService, TeamCoordinator (선택적)

ChatPanel ──→ useClaudeSocket (WS 연결+상태)
          ├─→ useWorkflowStatus / useWorkflowActions (워크플로우)
          ├─→ useChatArtifact (아티팩트 뷰어)
          ├─→ useChatSearch (검색)
          ├─→ useChatNotifications (알림)
          ├─→ useChatSessionActions (삭제/아카이브/워크트리)
          ├─→ useGitInfo (Git 상태)
          └─→ useSlashCommands (슬래시 명령어)
```

### 3.4 핵심 성능 최적화 현황

- 가상 스크롤 (`@tanstack/react-virtual`, overscan=10)
- RAF 배치 (텍스트 스트리밍 + 스크롤 throttle)
- 컴포넌트 memo + useCallback 체계적 적용
- messageGaps 스트리밍 중 재계산 억제 (`prevGapsRef`)
- 300+ 메시지 트렁케이션 (idle 전환 시)
- Split View: focused pane만 invalidate
- DB 배치 COPY 프로토콜
- 벤더 청크 스플리팅 (react, tanstack, radix-ui, markdown, echarts, dnd)
