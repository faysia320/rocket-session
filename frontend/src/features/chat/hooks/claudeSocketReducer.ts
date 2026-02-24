import type {
  Message,
  FileChange,
  PermissionRequestData,
  ToolUseMsg,
  AssistantTextMsg,
  ResultMsg,
  AskUserQuestionMsg,
  AskUserQuestionItem,
  MessageUpdate,
} from "@/types";
import { getMessageText } from "@/types";
import { generateMessageId, RECONNECT_MAX_ATTEMPTS } from "./useClaudeSocket.utils";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface TodoItem {
  content: string;
  status: "completed" | "in_progress" | "pending";
  activeForm?: string;
}

export interface SessionState {
  claude_session_id?: string;
  work_dir?: string;
  name?: string;
  status?: string;
  allowed_tools?: string;
  system_prompt?: string;
  timeout_seconds?: number;
  permission_mode?: number;
  permission_required_tools?: string;
  model?: string;
  worktree_name?: string | null;
  workflow_enabled?: boolean;
  workflow_phase?: string | null;
  workflow_phase_status?: string | null;
}

export interface ReconnectState {
  status: "connected" | "reconnecting" | "failed";
  attempt: number;
  maxAttempts: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface ClaudeSocketState {
  connected: boolean;
  loading: boolean;
  messages: Message[];
  status: "idle" | "running" | "error";
  sessionInfo: SessionState | null;
  fileChanges: FileChange[];
  activeTools: ToolUseMsg[];
  pendingPermission: PermissionRequestData | null;
  reconnectState: ReconnectState;
  tokenUsage: TokenUsage;
  /** answered && !sent 인 ask_user_question 메시지 수 (O(1) 조회용) */
  pendingAnswerCount: number;
  /** PinnedTodoBar에 표시할 최신 TodoWrite 상태 */
  pinnedTodos: TodoItem[];
}

export const initialState: ClaudeSocketState = {
  connected: false,
  loading: true,
  messages: [],
  status: "idle",
  sessionInfo: null,
  fileChanges: [],
  activeTools: [],
  pendingPermission: null,
  reconnectState: {
    status: "reconnecting",
    attempt: 0,
    maxAttempts: RECONNECT_MAX_ATTEMPTS,
  },
  tokenUsage: {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  },
  pendingAnswerCount: 0,
  pinnedTodos: [],
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface HistoryItem {
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp?: string;
  cost?: number;
  duration_ms?: number;
  is_error?: boolean | number;
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
  model?: string;
  // tool_use / tool_result 관련 필드
  message_type?: "tool_use" | "tool_result" | null;
  tool_use_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

export type ClaudeSocketAction =
  | { type: "RESET_SESSION" }
  | { type: "SET_CONNECTED"; connected: boolean }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "WS_OPEN"; hadPriorSeq: boolean }
  | { type: "RECONNECT_SCHEDULE"; attempt: number }
  | { type: "RECONNECT_FAILED"; attempt: number }
  | { type: "RECONNECT_RESET" }
  // WebSocket message actions
  | {
      type: "WS_SESSION_STATE";
      session: SessionState;
      isRunning: boolean;
      isReconnect: boolean;
      history: HistoryItem[] | null;
      latestSeq: number | undefined;
      currentTurnEvents: Record<string, unknown>[] | null;
      pendingInteractions: {
        permission?: {
          permission_id: string;
          tool_name: string;
          tool_input: Record<string, unknown>;
        };
      } | null;
    }
  | { type: "WS_SESSION_INFO"; claudeSessionId: string }
  | { type: "WS_STATUS"; status: "idle" | "running" | "error" }
  | { type: "WS_USER_MESSAGE"; data: Record<string, unknown> }
  | { type: "WS_ASSISTANT_TEXT"; data: AssistantTextMsg }
  | { type: "WS_TOOL_USE"; data: ToolUseMsg }
  | {
      type: "WS_TOOL_RESULT";
      toolUseId: string;
      output: string;
      isError: boolean;
      isTruncated: boolean | undefined;
      fullLength: number | undefined;
      timestamp: string;
    }
  | { type: "WS_FILE_CHANGE"; change: FileChange }
  | {
      type: "WS_RESULT";
      data: ResultMsg;
      workflowPhase: string | null;
      inputTokens: number;
      outputTokens: number;
      cacheCreationTokens: number;
      cacheReadTokens: number;
    }
  | { type: "WS_ERROR"; data: Record<string, unknown>; isSessionNotFound: boolean }
  | { type: "WS_STDERR"; text: string }
  | { type: "WS_STOPPED" }
  | { type: "WS_THINKING"; data: Record<string, unknown> }
  | { type: "WS_EVENT"; event: Record<string, unknown> }
  | {
      type: "WS_ASK_USER_QUESTION";
      questions: AskUserQuestionItem[];
      toolUseId: string;
      timestamp: string;
    }
  | { type: "WS_PERMISSION_REQUEST"; permData: PermissionRequestData }
  | { type: "WS_PERMISSION_RESPONSE"; reason: string | undefined }
  | { type: "WS_RAW"; text: string }
  // Workflow events
  | { type: "WS_WORKFLOW_STARTED"; phase: string }
  | { type: "WS_WORKFLOW_PHASE_COMPLETED"; phase: string }
  | { type: "WS_WORKFLOW_PHASE_APPROVED"; phase: string; nextPhase: string | null }
  | { type: "WS_WORKFLOW_PHASE_REVISION"; phase: string }
  | { type: "WS_WORKFLOW_COMPLETED" }
  | { type: "WS_WORKFLOW_DATA_CHANGED"; eventType: string; artifactId?: number }
  // User actions
  | { type: "ANSWER_QUESTION"; messageId: string; questionIndex: number; selectedLabels: string[] }
  | { type: "CONFIRM_ANSWERS"; messageId: string }
  | { type: "MARK_ANSWERS_SENT" }
  | { type: "CLEAR_MESSAGES" }
  | { type: "ADD_SYSTEM_MESSAGE"; text: string }
  | { type: "UPDATE_MESSAGE"; id: string; patch: MessageUpdate }
  | { type: "CLEAR_PENDING_PERMISSION"; behavior?: "allow" | "deny" }
  | { type: "TRUNCATE_OLD_MESSAGES"; maxFull: number };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * messages 배열에서 pendingAnswerCount를 재계산.
 * 전체 재빌드 시(RESET, SESSION_STATE 등)에만 호출.
 */
function recomputePendingAnswerCount(messages: Message[]): number {
  let count = 0;
  for (const m of messages) {
    if (
      m.type === "ask_user_question" &&
      (m as AskUserQuestionMsg).answered &&
      !(m as AskUserQuestionMsg).sent
    ) {
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function claudeSocketReducer(
  state: ClaudeSocketState,
  action: ClaudeSocketAction,
): ClaudeSocketState {
  switch (action.type) {
    case "RESET_SESSION":
      return { ...initialState };

    case "SET_CONNECTED":
      return { ...state, connected: action.connected };

    case "SET_LOADING":
      return { ...state, loading: action.loading };

    case "WS_OPEN":
      return {
        ...state,
        connected: true,
        reconnectState: { status: "connected", attempt: 0, maxAttempts: RECONNECT_MAX_ATTEMPTS },
        activeTools: action.hadPriorSeq ? [] : state.activeTools,
      };

    case "RECONNECT_SCHEDULE":
      return {
        ...state,
        connected: false,
        reconnectState: {
          status: "reconnecting",
          attempt: action.attempt,
          maxAttempts: RECONNECT_MAX_ATTEMPTS,
        },
      };

    case "RECONNECT_FAILED":
      return {
        ...state,
        connected: false,
        reconnectState: {
          status: "failed",
          attempt: action.attempt,
          maxAttempts: RECONNECT_MAX_ATTEMPTS,
        },
      };

    case "RECONNECT_RESET":
      return {
        ...state,
        reconnectState: { status: "reconnecting", attempt: 0, maxAttempts: RECONNECT_MAX_ATTEMPTS },
      };

    // ----- WebSocket messages -----

    case "WS_SESSION_STATE": {
      let newMessages = state.messages;
      let newTokenUsage = state.tokenUsage;
      let lastTodoWriteTodos: TodoItem[] = [];
      const newStatus = action.isRunning ? ("running" as const) : state.status;

      if (!action.isReconnect && action.history) {
        // tool_result를 tool_use_id로 인덱싱 (tool_use 메시지에 병합용)
        const toolResultMap = new Map<string, HistoryItem>();
        for (const h of action.history) {
          if (h.message_type === "tool_result" && h.tool_use_id) {
            toolResultMap.set(h.tool_use_id, h);
          }
        }

        newMessages = action.history
          .filter((h) => h.message_type !== "tool_result") // tool_result는 tool_use에 병합
          .map((h, index) => {
            // tool_use 메시지
            if (h.message_type === "tool_use") {
              const result = h.tool_use_id ? toolResultMap.get(h.tool_use_id) : undefined;
              return {
                id: `hist-${index}`,
                type: "tool_use" as const,
                tool: h.tool_name || "unknown",
                input: h.tool_input || {},
                tool_use_id: h.tool_use_id || "",
                status: "done" as const,
                output: result?.content,
                is_error: result ? Boolean(result.is_error) : false,
                timestamp: h.timestamp,
              } as Message;
            }

            // user 메시지
            if (h.role === "user") {
              return {
                id: `hist-${index}`,
                type: "user_message" as const,
                message: h as unknown as Record<string, unknown>,
                text: h.content,
                content: h.content,
                timestamp: h.timestamp,
              } as Message;
            }

            // assistant 최종 응답 (result)
            return {
              id: `hist-${index}`,
              type: "result" as const,
              text: h.content,
              timestamp: h.timestamp,
              cost: h.cost,
              duration_ms: h.duration_ms,
              is_error: Boolean(h.is_error),
              input_tokens: h.input_tokens,
              output_tokens: h.output_tokens,
              cache_creation_tokens: h.cache_creation_tokens,
              cache_read_tokens: h.cache_read_tokens,
              model: h.model,
            } as Message;
          });

        // TodoWrite 메시지를 필터링하고 마지막 TodoWrite의 todos를 pinnedTodos로 설정
        newMessages = newMessages.filter((m) => {
          if (m.type === "tool_use" && (m as ToolUseMsg).tool === "TodoWrite") {
            const input = (m as ToolUseMsg).input;
            if (Array.isArray(input?.todos)) lastTodoWriteTodos = input.todos as TodoItem[];
            return false;
          }
          return true;
        });

        // 토큰 집계: text 메시지(result)만 대상 (tool 메시지 제외)
        let totalIn = 0,
          totalOut = 0,
          totalCacheCreate = 0,
          totalCacheRead = 0;
        for (const h of action.history) {
          if (!h.message_type) {
            totalIn += h.input_tokens || 0;
            totalOut += h.output_tokens || 0;
            totalCacheCreate += h.cache_creation_tokens || 0;
            totalCacheRead += h.cache_read_tokens || 0;
          }
        }
        newTokenUsage = {
          inputTokens: totalIn,
          outputTokens: totalOut,
          cacheCreationTokens: totalCacheCreate,
          cacheReadTokens: totalCacheRead,
        };
      }

      // 백엔드에서 전달된 대기 중인 permission 복원 (네비게이션 후 복귀 시)
      let newPendingPermission = state.pendingPermission;
      if (action.pendingInteractions?.permission) {
        const p = action.pendingInteractions.permission;
        newPendingPermission = {
          permission_id: p.permission_id,
          tool_name: p.tool_name,
          tool_input: p.tool_input,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        ...state,
        sessionInfo: action.session,
        loading: false,
        status: newStatus,
        messages: newMessages,
        tokenUsage: newTokenUsage,
        pendingPermission: newPendingPermission,
        // history 재빌드 시 pendingAnswerCount 재계산
        pendingAnswerCount: recomputePendingAnswerCount(newMessages),
        // history에서 마지막 TodoWrite 복원
        ...(action.history ? { pinnedTodos: lastTodoWriteTodos } : {}),
      };
    }

    case "WS_SESSION_INFO":
      return {
        ...state,
        sessionInfo: { ...state.sessionInfo, claude_session_id: action.claudeSessionId },
      };

    case "WS_STATUS": {
      if (action.status === "idle" || action.status === "error") {
        // running tool_use만 찾아서 done으로 변경 (전체 map 대신 타겟 인덱스만 복사)
        const runningIndices: number[] = [];
        for (let i = state.messages.length - 1; i >= 0; i--) {
          const m = state.messages[i];
          // user_message/result를 만나면 더 이전에는 running이 없을 것
          if (m.type === "user_message" || m.type === "result") break;
          if (m.type === "tool_use" && m.status === "running") {
            runningIndices.push(i);
          }
        }
        if (runningIndices.length === 0) {
          return { ...state, status: action.status, activeTools: [] };
        }
        const updated = [...state.messages];
        for (const idx of runningIndices) {
          updated[idx] = { ...updated[idx], status: "done" as const } as Message;
        }
        return { ...state, status: action.status, activeTools: [], messages: updated };
      }
      return { ...state, status: action.status };
    }

    case "WS_USER_MESSAGE": {
      // 백엔드 user_message 형태: { type: "user_message", message: { role, content, timestamp } }
      const userMsg = action.data.message as
        | { content?: string; prompt?: string; timestamp?: string }
        | undefined;
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: generateMessageId(),
            type: "user_message" as const,
            content: userMsg?.content || String(action.data.prompt || ""),
            timestamp: userMsg?.timestamp || new Date().toISOString(),
            message: userMsg,
          },
        ],
      };
    }

    case "WS_ASSISTANT_TEXT": {
      const prev = state.messages;
      let lastIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        const t = prev[i].type;
        if (t === "user_message" || t === "result" || t === "tool_use" || t === "tool_result")
          break;
        if (t === "assistant_text") {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx >= 0) {
        // F#9: 텍스트가 동일하면 배열 복사 건너뛰기 (RAF 배치에서 중복 이벤트 방지)
        const existing = prev[lastIdx] as AssistantTextMsg;
        if (existing.text === action.data.text) return state;
        const newMsg = { ...action.data, id: prev[lastIdx].id };
        // 마지막 요소 업데이트 시 slice 패턴 (가장 흔한 케이스)
        if (lastIdx === prev.length - 1) {
          return { ...state, messages: [...prev.slice(0, -1), newMsg] };
        }
        const updated = [...prev];
        updated[lastIdx] = newMsg;
        return { ...state, messages: updated };
      }
      return {
        ...state,
        messages: [...prev, { ...action.data, id: generateMessageId() } as Message],
      };
    }

    case "WS_TOOL_USE": {
      // TodoWrite → pinnedTodos 갱신 (messages에 추가하지 않음)
      if (action.data.tool === "TodoWrite") {
        const todos = Array.isArray(action.data.input?.todos)
          ? (action.data.input.todos as TodoItem[])
          : [];
        return {
          ...state,
          pinnedTodos: todos,
          activeTools: [...state.activeTools, action.data],
        };
      }
      return {
        ...state,
        messages: [
          ...state.messages,
          { ...action.data, id: generateMessageId(), status: "running" as const },
        ],
        activeTools: [...state.activeTools, action.data],
      };
    }

    case "WS_TOOL_RESULT": {
      // 역방향 검색: tool_use는 보통 배열 끝 부근에 있으므로 O(1)에 가까움
      const msgs = state.messages;
      let targetIdx = -1;
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.type === "tool_use" && m.tool_use_id === action.toolUseId && m.status === "running") {
          targetIdx = i;
          break;
        }
      }
      if (targetIdx < 0)
        return {
          ...state,
          activeTools: state.activeTools.filter((t) => t.tool_use_id !== action.toolUseId),
        };
      const updatedMsgs = [...msgs];
      updatedMsgs[targetIdx] = {
        ...msgs[targetIdx],
        status: action.isError ? "error" : "done",
        output: action.output,
        is_error: action.isError,
        is_truncated: action.isTruncated,
        full_length: action.fullLength,
        completed_at: action.timestamp,
      } as Message;
      return {
        ...state,
        messages: updatedMsgs,
        activeTools: state.activeTools.filter((t) => t.tool_use_id !== action.toolUseId),
      };
    }

    case "WS_FILE_CHANGE": {
      const MAX_FILE_CHANGES = 500;
      const newChanges = [...state.fileChanges, action.change];
      return {
        ...state,
        fileChanges:
          newChanges.length > MAX_FILE_CHANGES
            ? newChanges.slice(newChanges.length - MAX_FILE_CHANGES)
            : newChanges,
      };
    }

    case "WS_RESULT": {
      const prev = state.messages;

      // history에서 복원된 result 메시지를 workflow_phase로 업그레이드
      // (네비게이션 후 돌아올 때 current_turn_events 재생으로 호출됨)
      const lastMsg = prev.length > 0 ? prev[prev.length - 1] : null;
      if (
        lastMsg &&
        lastMsg.type === "result" &&
        lastMsg.id.startsWith("hist-") &&
        !(lastMsg as ResultMsg).workflow_phase
      ) {
        const text = action.data.text || (lastMsg as ResultMsg).text;
        const upgraded = {
          ...lastMsg,
          workflow_phase: action.workflowPhase,
          text,
        } as Message;

        return {
          ...state,
          messages: [...prev.slice(0, -1), upgraded],
        };
      }

      let lastAssistantIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].type === "user_message" || prev[i].type === "result") break;
        if (prev[i].type === "assistant_text") {
          lastAssistantIdx = i;
          break;
        }
      }
      const assistantText =
        lastAssistantIdx >= 0 ? (prev[lastAssistantIdx] as AssistantTextMsg).text : undefined;
      const cleaned =
        lastAssistantIdx >= 0
          ? [...prev.slice(0, lastAssistantIdx), ...prev.slice(lastAssistantIdx + 1)]
          : prev;
      const text = action.data.text || assistantText;

      const newTokenUsage =
        action.inputTokens || action.outputTokens
          ? {
              inputTokens: state.tokenUsage.inputTokens + action.inputTokens,
              outputTokens: state.tokenUsage.outputTokens + action.outputTokens,
              cacheCreationTokens:
                state.tokenUsage.cacheCreationTokens + action.cacheCreationTokens,
              cacheReadTokens: state.tokenUsage.cacheReadTokens + action.cacheReadTokens,
            }
          : state.tokenUsage;

      return {
        ...state,
        messages: [
          ...cleaned,
          {
            ...action.data,
            text,
            id: generateMessageId(),
            workflow_phase: action.workflowPhase,
          } as Message,
        ],
        tokenUsage: newTokenUsage,
      };
    }

    case "WS_ERROR":
      return {
        ...state,
        messages: [
          ...state.messages,
          { ...(action.data as unknown as Message), id: generateMessageId() },
        ],
        // 세션 미발견이 아닌 경우 방어적으로 error 상태 설정
        // (백엔드 finally에서 STATUS 이벤트가 후속 전송되지만, 네트워크 문제로 누락될 수 있음)
        status: action.isSessionNotFound ? state.status : "error",
      };

    case "WS_STDERR":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: generateMessageId(), type: "stderr", text: action.text },
        ],
      };

    case "WS_STOPPED": {
      const msgs = state.messages;
      // 역방향 검색: running 상태인 tool_use만 찾아서 변경 (전체 map 대신 O(최근 턴) 탐색)
      const runningIndices: number[] = [];
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.type === "user_message" || m.type === "result") break;
        if (m.type === "tool_use" && m.status === "running") {
          runningIndices.push(i);
        }
      }
      const systemMsg = {
        id: generateMessageId(),
        type: "system" as const,
        text: "Session stopped by user.",
      };
      if (runningIndices.length === 0) {
        return {
          ...state,
          status: "idle",
          activeTools: [],
          messages: [...msgs, systemMsg],
        };
      }
      const updated = [...msgs];
      for (const idx of runningIndices) {
        updated[idx] = { ...msgs[idx], status: "done" as const } as Message;
      }
      return {
        ...state,
        status: "idle",
        activeTools: [],
        messages: [...updated, systemMsg],
      };
    }

    case "WS_THINKING": {
      const prev = state.messages;
      let lastIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        const t = prev[i].type;
        if (t === "user_message" || t === "result" || t === "tool_use" || t === "tool_result")
          break;
        if (t === "thinking") {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx >= 0) {
        const updated = [...prev];
        updated[lastIdx] = { ...(action.data as unknown as Message), id: prev[lastIdx].id };
        return { ...state, messages: updated };
      }
      return {
        ...state,
        messages: [...prev, { ...(action.data as unknown as Message), id: generateMessageId() }],
      };
    }

    case "WS_EVENT":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: generateMessageId(), type: "event", event: action.event },
        ],
      };

    case "WS_ASK_USER_QUESTION":
      // 새 질문 추가 — answered=false이므로 pendingAnswerCount 변동 없음
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: generateMessageId(),
            type: "ask_user_question",
            questions: action.questions,
            tool_use_id: action.toolUseId,
            answers: {},
            answered: false,
            sent: false,
            timestamp: action.timestamp,
          } as AskUserQuestionMsg,
        ],
      };

    case "WS_PERMISSION_REQUEST":
      return {
        ...state,
        pendingPermission: action.permData,
        messages: [
          ...state.messages,
          {
            id: generateMessageId(),
            type: "permission_request",
            tool: action.permData.tool_name,
            input: action.permData.tool_input,
            timestamp: action.permData.timestamp,
          },
        ],
      };

    case "WS_PERMISSION_RESPONSE": {
      // 가장 최근의 미처리 permission_request 메시지를 resolved로 마킹
      let msgs = state.messages;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (
          msgs[i].type === "permission_request" &&
          !(msgs[i] as import("@/types").PermissionRequestMsg).resolved
        ) {
          const updated = [...msgs];
          updated[i] = {
            ...msgs[i],
            resolved: true,
            resolution: action.reason === "denied" ? "deny" : "allow",
          } as Message;
          msgs = updated;
          break;
        }
      }
      if (action.reason) {
        msgs = [
          ...msgs,
          {
            id: generateMessageId(),
            type: "system" as const,
            text: `Permission: ${action.reason}`,
          },
        ];
      }
      return { ...state, pendingPermission: null, messages: msgs };
    }

    case "WS_WORKFLOW_STARTED":
      return {
        ...state,
        sessionInfo: state.sessionInfo
          ? {
              ...state.sessionInfo,
              workflow_enabled: true,
              workflow_phase: action.phase,
              workflow_phase_status: "in_progress",
            }
          : state.sessionInfo,
      };

    case "WS_WORKFLOW_PHASE_COMPLETED":
      return {
        ...state,
        sessionInfo: state.sessionInfo
          ? {
              ...state.sessionInfo,
              workflow_phase: action.phase,
              workflow_phase_status: "awaiting_approval",
            }
          : state.sessionInfo,
      };

    case "WS_WORKFLOW_PHASE_REVISION":
      return {
        ...state,
        sessionInfo: state.sessionInfo
          ? {
              ...state.sessionInfo,
              workflow_phase: action.phase,
              workflow_phase_status: "in_progress",
            }
          : state.sessionInfo,
      };

    case "WS_WORKFLOW_DATA_CHANGED":
      // 아티팩트/주석 변경 신호 — 프론트엔드에서 TanStack Query invalidation 용도
      return state;

    case "WS_WORKFLOW_PHASE_APPROVED":
      return {
        ...state,
        sessionInfo: state.sessionInfo
          ? {
              ...state.sessionInfo,
              workflow_phase: action.nextPhase,
              workflow_phase_status: action.nextPhase ? "in_progress" : null,
            }
          : state.sessionInfo,
      };

    case "WS_WORKFLOW_COMPLETED":
      return {
        ...state,
        sessionInfo: state.sessionInfo
          ? {
              ...state.sessionInfo,
              workflow_phase: "implement",
              workflow_phase_status: "completed",
            }
          : state.sessionInfo,
      };

    case "WS_RAW":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: generateMessageId(), type: "stderr", text: action.text },
        ],
      };

    // ----- User actions -----

    case "ANSWER_QUESTION":
      return {
        ...state,
        messages: state.messages.map((m) => {
          if (m.id !== action.messageId || m.type !== "ask_user_question") return m;
          const msg = m as AskUserQuestionMsg;
          return {
            ...msg,
            answers: { ...msg.answers, [action.questionIndex]: action.selectedLabels },
          } as Message;
        }),
      };

    case "CONFIRM_ANSWERS": {
      // answered: false → true 전환 시 pendingAnswerCount 증가
      let delta = 0;
      const newMessages = state.messages.map((m) => {
        if (m.id !== action.messageId || m.type !== "ask_user_question") return m;
        const msg = m as AskUserQuestionMsg;
        if (!msg.answered && !msg.sent) {
          // answered=false → true, sent=false → pending 카운트 +1
          delta = 1;
        }
        return { ...m, answered: true } as Message;
      });
      return {
        ...state,
        messages: newMessages,
        pendingAnswerCount: state.pendingAnswerCount + delta,
      };
    }

    case "MARK_ANSWERS_SENT": {
      // answered && !sent → sent=true 시 pendingAnswerCount를 0으로
      let count = 0;
      const newMessages = state.messages.map((m) => {
        if (
          m.type === "ask_user_question" &&
          (m as AskUserQuestionMsg).answered &&
          !(m as AskUserQuestionMsg).sent
        ) {
          count++;
          return { ...m, sent: true } as Message;
        }
        return m;
      });
      return {
        ...state,
        messages: newMessages,
        pendingAnswerCount: state.pendingAnswerCount - count,
      };
    }

    case "CLEAR_MESSAGES":
      return {
        ...state,
        messages: [],
        fileChanges: [],
        tokenUsage: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
        pendingAnswerCount: 0,
        pinnedTodos: [],
        // 워크플로우 활성 시 Research 초기 상태로 리셋
        sessionInfo: state.sessionInfo?.workflow_enabled
          ? {
              ...state.sessionInfo,
              workflow_phase: "research",
              workflow_phase_status: "in_progress",
            }
          : state.sessionInfo,
      };

    case "ADD_SYSTEM_MESSAGE":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: generateMessageId(), type: "system" as const, text: action.text },
        ],
      };

    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? ({ ...m, ...action.patch } as Message) : m,
        ),
      };

    case "CLEAR_PENDING_PERMISSION": {
      // respondPermission()에서 호출: 로컬에서 즉시 permission_request를 resolved로 마킹
      let msgs = state.messages;
      if (action.behavior) {
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (
            msgs[i].type === "permission_request" &&
            !(msgs[i] as import("@/types").PermissionRequestMsg).resolved
          ) {
            const updated = [...msgs];
            updated[i] = { ...msgs[i], resolved: true, resolution: action.behavior } as Message;
            msgs = updated;
            break;
          }
        }
      }
      return { ...state, pendingPermission: null, messages: msgs };
    }

    case "TRUNCATE_OLD_MESSAGES": {
      if (state.status !== "idle" || state.messages.length <= action.maxFull) return state;
      const cutoff = state.messages.length - action.maxFull;
      let changed = false;
      const updated = state.messages.map((m, i) => {
        const mText = getMessageText(m);
        if (i < cutoff && mText.length > 500 && !m._truncated) {
          changed = true;
          return {
            ...m,
            text:
              mText.slice(0, 200) + "\n\n\u2026 (이전 메시지, 전체 내용은 내보내기를 사용하세요)",
            _truncated: true,
          } as Message;
        }
        return m;
      });
      return changed ? { ...state, messages: updated } : state;
    }

    default:
      return state;
  }
}
