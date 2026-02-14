import type {
  Message,
  FileChange,
  SessionMode,
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

export interface SessionState {
  claude_session_id?: string;
  work_dir?: string;
  mode?: SessionMode;
  name?: string;
  status?: string;
  allowed_tools?: string;
  system_prompt?: string;
  timeout_seconds?: number;
  permission_mode?: number;
  permission_required_tools?: string;
  model?: string;
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
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

interface HistoryItem {
  role: "user" | "assistant";
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
  | { type: "WS_SESSION_STATE"; session: SessionState; isRunning: boolean; isReconnect: boolean; history: HistoryItem[] | null; latestSeq: number | undefined; currentTurnEvents: Record<string, unknown>[] | null }
  | { type: "WS_SESSION_INFO"; claudeSessionId: string }
  | { type: "WS_STATUS"; status: "idle" | "running" | "error" }
  | { type: "WS_USER_MESSAGE"; data: Record<string, unknown> }
  | { type: "WS_ASSISTANT_TEXT"; data: AssistantTextMsg }
  | { type: "WS_TOOL_USE"; data: ToolUseMsg }
  | { type: "WS_TOOL_RESULT"; toolUseId: string; output: string; isError: boolean; isTruncated: boolean | undefined; fullLength: number | undefined; timestamp: string }
  | { type: "WS_FILE_CHANGE"; change: FileChange }
  | { type: "WS_RESULT"; data: ResultMsg; mode: "normal" | "plan"; inputTokens: number; outputTokens: number; cacheCreationTokens: number; cacheReadTokens: number }
  | { type: "WS_ERROR"; data: Record<string, unknown>; isSessionNotFound: boolean }
  | { type: "WS_STDERR"; text: string }
  | { type: "WS_STOPPED" }
  | { type: "WS_THINKING"; data: Record<string, unknown> }
  | { type: "WS_EVENT"; event: Record<string, unknown> }
  | { type: "WS_ASK_USER_QUESTION"; questions: AskUserQuestionItem[]; toolUseId: string; timestamp: string }
  | { type: "WS_PERMISSION_REQUEST"; permData: PermissionRequestData }
  | { type: "WS_PERMISSION_RESPONSE"; reason: string | undefined }
  | { type: "WS_MODE_CHANGE"; fromMode: string; toMode: SessionMode }
  | { type: "WS_RAW"; text: string }
  // User actions
  | { type: "ANSWER_QUESTION"; messageId: string; questionIndex: number; selectedLabels: string[] }
  | { type: "CONFIRM_ANSWERS"; messageId: string }
  | { type: "MARK_ANSWERS_SENT" }
  | { type: "CLEAR_MESSAGES" }
  | { type: "ADD_SYSTEM_MESSAGE"; text: string }
  | { type: "UPDATE_MESSAGE"; id: string; patch: MessageUpdate }
  | { type: "CLEAR_PENDING_PERMISSION" }
  | { type: "UPDATE_SESSION_MODE"; mode: SessionMode }
  | { type: "TRUNCATE_OLD_MESSAGES"; maxFull: number };

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
        reconnectState: { status: "reconnecting", attempt: action.attempt, maxAttempts: RECONNECT_MAX_ATTEMPTS },
      };

    case "RECONNECT_FAILED":
      return {
        ...state,
        connected: false,
        reconnectState: { status: "failed", attempt: action.attempt, maxAttempts: RECONNECT_MAX_ATTEMPTS },
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
      const newStatus = action.isRunning ? "running" as const : state.status;

      if (!action.isReconnect && action.history) {
        newMessages = action.history.map((h, index) => ({
          id: `hist-${index}`,
          type: h.role === "user" ? "user_message" : "result",
          message: h as unknown as string,
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
        }) as Message);

        let totalIn = 0, totalOut = 0, totalCacheCreate = 0, totalCacheRead = 0;
        for (const h of action.history) {
          totalIn += h.input_tokens || 0;
          totalOut += h.output_tokens || 0;
          totalCacheCreate += h.cache_creation_tokens || 0;
          totalCacheRead += h.cache_read_tokens || 0;
        }
        newTokenUsage = {
          inputTokens: totalIn,
          outputTokens: totalOut,
          cacheCreationTokens: totalCacheCreate,
          cacheReadTokens: totalCacheRead,
        };
      }

      return {
        ...state,
        sessionInfo: action.session,
        loading: false,
        status: newStatus,
        messages: newMessages,
        tokenUsage: newTokenUsage,
      };
    }

    case "WS_SESSION_INFO":
      return {
        ...state,
        sessionInfo: { ...state.sessionInfo, claude_session_id: action.claudeSessionId },
      };

    case "WS_STATUS": {
      if (action.status === "idle" || action.status === "error") {
        return {
          ...state,
          status: action.status,
          activeTools: [],
          messages: state.messages.map((msg) =>
            msg.type === "tool_use" && msg.status === "running"
              ? ({ ...msg, status: "done" as const } as Message)
              : msg,
          ),
        };
      }
      return { ...state, status: action.status };
    }

    case "WS_USER_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, { ...(action.data as unknown as Message), id: generateMessageId() }],
      };

    case "WS_ASSISTANT_TEXT": {
      const prev = state.messages;
      let lastIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        const t = prev[i].type;
        if (t === "user_message" || t === "result" || t === "tool_use" || t === "tool_result") break;
        if (t === "assistant_text") { lastIdx = i; break; }
      }
      if (lastIdx >= 0) {
        const updated = [...prev];
        updated[lastIdx] = { ...action.data, id: prev[lastIdx].id };
        return { ...state, messages: updated };
      }
      return {
        ...state,
        messages: [...prev, { ...action.data, id: generateMessageId() } as Message],
      };
    }

    case "WS_TOOL_USE":
      return {
        ...state,
        messages: [...state.messages, { ...action.data, id: generateMessageId(), status: "running" as const }],
        activeTools: [...state.activeTools, action.data],
      };

    case "WS_TOOL_RESULT":
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.type === "tool_use" && msg.tool_use_id === action.toolUseId && msg.status === "running"
            ? ({
                ...msg,
                status: action.isError ? "error" : "done",
                output: action.output,
                is_error: action.isError,
                is_truncated: action.isTruncated,
                full_length: action.fullLength,
                completed_at: action.timestamp,
              } as Message)
            : msg,
        ),
        activeTools: state.activeTools.filter((t) => t.tool_use_id !== action.toolUseId),
      };

    case "WS_FILE_CHANGE":
      return { ...state, fileChanges: [...state.fileChanges, action.change] };

    case "WS_RESULT": {
      const prev = state.messages;
      let lastAssistantIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].type === "user_message" || prev[i].type === "result") break;
        if (prev[i].type === "assistant_text") { lastAssistantIdx = i; break; }
      }
      const assistantText = lastAssistantIdx >= 0
        ? (prev[lastAssistantIdx] as AssistantTextMsg).text
        : undefined;
      const cleaned = lastAssistantIdx >= 0
        ? [...prev.slice(0, lastAssistantIdx), ...prev.slice(lastAssistantIdx + 1)]
        : prev;
      const text = action.data.text || assistantText;

      const newTokenUsage = (action.inputTokens || action.outputTokens)
        ? {
            inputTokens: state.tokenUsage.inputTokens + action.inputTokens,
            outputTokens: state.tokenUsage.outputTokens + action.outputTokens,
            cacheCreationTokens: state.tokenUsage.cacheCreationTokens + action.cacheCreationTokens,
            cacheReadTokens: state.tokenUsage.cacheReadTokens + action.cacheReadTokens,
          }
        : state.tokenUsage;

      return {
        ...state,
        messages: [
          ...cleaned,
          { ...action.data, text, id: generateMessageId(), mode: action.mode } as Message,
        ],
        tokenUsage: newTokenUsage,
      };
    }

    case "WS_ERROR":
      return {
        ...state,
        messages: [...state.messages, { ...(action.data as unknown as Message), id: generateMessageId() }],
      };

    case "WS_STDERR":
      return {
        ...state,
        messages: [...state.messages, { id: generateMessageId(), type: "stderr", text: action.text }],
      };

    case "WS_STOPPED": {
      const cleaned = state.messages.map((msg) =>
        msg.type === "tool_use" && msg.status === "running"
          ? ({ ...msg, status: "done" as const } as Message)
          : msg,
      );
      return {
        ...state,
        status: "idle",
        activeTools: [],
        messages: [
          ...cleaned,
          { id: generateMessageId(), type: "system" as const, text: "Session stopped by user." },
        ],
      };
    }

    case "WS_THINKING": {
      const prev = state.messages;
      let lastIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        const t = prev[i].type;
        if (t === "user_message" || t === "result" || t === "tool_use" || t === "tool_result") break;
        if (t === "thinking") { lastIdx = i; break; }
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
        messages: [...state.messages, { id: generateMessageId(), type: "event", event: action.event }],
      };

    case "WS_ASK_USER_QUESTION":
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
      const newMessages = action.reason
        ? [...state.messages, { id: generateMessageId(), type: "system" as const, text: `Permission: ${action.reason}` }]
        : state.messages;
      return { ...state, pendingPermission: null, messages: newMessages };
    }

    case "WS_MODE_CHANGE":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: generateMessageId(), type: "system" as const, text: `Mode: ${action.fromMode} → ${action.toMode}` },
        ],
        sessionInfo: state.sessionInfo
          ? { ...state.sessionInfo, mode: action.toMode }
          : state.sessionInfo,
      };

    case "WS_RAW":
      return {
        ...state,
        messages: [...state.messages, { id: generateMessageId(), type: "stderr", text: action.text }],
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

    case "CONFIRM_ANSWERS":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.messageId && m.type === "ask_user_question"
            ? ({ ...m, answered: true } as Message)
            : m,
        ),
      };

    case "MARK_ANSWERS_SENT":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.type === "ask_user_question" &&
          (m as AskUserQuestionMsg).answered &&
          !(m as AskUserQuestionMsg).sent
            ? ({ ...m, sent: true } as Message)
            : m,
        ),
      };

    case "CLEAR_MESSAGES":
      return { ...state, messages: [], fileChanges: [] };

    case "ADD_SYSTEM_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, { id: generateMessageId(), type: "system" as const, text: action.text }],
      };

    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? ({ ...m, ...action.patch } as Message) : m,
        ),
      };

    case "CLEAR_PENDING_PERMISSION":
      return { ...state, pendingPermission: null };

    case "UPDATE_SESSION_MODE":
      return {
        ...state,
        sessionInfo: state.sessionInfo
          ? { ...state.sessionInfo, mode: action.mode }
          : state.sessionInfo,
      };

    case "TRUNCATE_OLD_MESSAGES": {
      if (state.status !== "idle" || state.messages.length <= action.maxFull) return state;
      const cutoff = state.messages.length - action.maxFull;
      let changed = false;
      const updated = state.messages.map((m, i) => {
        const mText = getMessageText(m);
        if (i < cutoff && mText.length > 500 && !(m as any)._truncated) {
          changed = true;
          return {
            ...m,
            text: mText.slice(0, 200) + "\n\n\u2026 (이전 메시지, 전체 내용은 내보내기를 사용하세요)",
            _truncated: true,
          } as any as Message;
        }
        return m;
      });
      return changed ? { ...state, messages: updated } : state;
    }

    default:
      return state;
  }
}
