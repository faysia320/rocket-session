/**
 * ClaudeSocket 리듀서 타입 정의 — 상태, 액션, 헬퍼 타입을 모아둡니다.
 */
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
  /** WS_ASSISTANT_TEXT가 기록, WS_RESULT가 소비하는 pending assistant_text 인덱스 */
  _pendingAssistantTextIdx: number | null;
  /** 대응하는 tool_use보다 먼저 도착한 orphaned tool_result 버퍼 */
  _orphanedToolResults: Record<
    string,
    {
      output: string;
      isError: boolean;
      isTruncated?: boolean;
      fullLength?: number;
      timestamp: string;
    }
  >;
}

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
  // Connection
  | { type: "RESET_SESSION" }
  | { type: "SET_CONNECTED"; connected: boolean }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "WS_OPEN"; hadPriorSeq: boolean }
  | { type: "RECONNECT_SCHEDULE"; attempt: number }
  | { type: "RECONNECT_FAILED"; attempt: number }
  | { type: "RECONNECT_RESET" }
  // WebSocket messages
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
        ask_user_question?: {
          questions: AskUserQuestionItem[];
          tool_use_id: string;
          timestamp: string;
        };
      } | null;
      fileChanges: FileChange[] | null;
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
export function recomputePendingAnswerCount(messages: Message[]): number {
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
