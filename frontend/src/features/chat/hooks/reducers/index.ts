/**
 * ClaudeSocket 리듀서 — 핸들러 그룹별로 디스패치합니다.
 */
import { RECONNECT_MAX_ATTEMPTS } from "../useClaudeSocket.utils";
import type { ClaudeSocketState, ClaudeSocketAction } from "./types";
import { handleConnection } from "./connectionHandlers";
import { handleWsMessage } from "./wsMessageHandlers";
import { handleWorkflow } from "./workflowHandlers";
import { handleUi } from "./uiHandlers";

export { type ClaudeSocketState, type ClaudeSocketAction } from "./types";
export {
  type TodoItem,
  type SessionState,
  type ReconnectState,
  type TokenUsage,
  type HistoryItem,
} from "./types";

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
  _pendingAssistantTextIdx: null,
  _orphanedToolResults: {},
};

// Connection action types
const CONNECTION_TYPES = new Set([
  "RESET_SESSION",
  "SET_CONNECTED",
  "SET_LOADING",
  "WS_OPEN",
  "RECONNECT_SCHEDULE",
  "RECONNECT_FAILED",
  "RECONNECT_RESET",
]);

// Workflow action types
const WORKFLOW_TYPES = new Set([
  "WS_WORKFLOW_STARTED",
  "WS_WORKFLOW_PHASE_COMPLETED",
  "WS_WORKFLOW_PHASE_APPROVED",
  "WS_WORKFLOW_PHASE_REVISION",
  "WS_WORKFLOW_COMPLETED",
  "WS_WORKFLOW_DATA_CHANGED",
]);

// UI action types
const UI_TYPES = new Set([
  "ANSWER_QUESTION",
  "CONFIRM_ANSWERS",
  "MARK_ANSWERS_SENT",
  "CLEAR_MESSAGES",
  "ADD_SYSTEM_MESSAGE",
  "UPDATE_MESSAGE",
  "CLEAR_PENDING_PERMISSION",
  "TRUNCATE_OLD_MESSAGES",
]);

export function claudeSocketReducer(
  state: ClaudeSocketState,
  action: ClaudeSocketAction,
): ClaudeSocketState {
  const { type } = action;

  if (CONNECTION_TYPES.has(type)) {
    return handleConnection(state, action as Parameters<typeof handleConnection>[1]);
  }
  if (WORKFLOW_TYPES.has(type)) {
    return handleWorkflow(state, action as Parameters<typeof handleWorkflow>[1]);
  }
  if (UI_TYPES.has(type)) {
    return handleUi(state, action as Parameters<typeof handleUi>[1]);
  }
  // 나머지는 모두 WS 메시지 핸들러
  return handleWsMessage(state, action as Parameters<typeof handleWsMessage>[1]);
}
