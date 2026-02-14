// ---------------------------------------------------------------------------
// FileChange
// ---------------------------------------------------------------------------
export interface FileChange {
  tool: string;
  file: string;
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// Base: all messages share these fields
// ---------------------------------------------------------------------------
interface BaseMessage {
  id: string;
  seq?: number;
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// Discriminated Union: individual message types
// ---------------------------------------------------------------------------
export interface UserMsg extends BaseMessage {
  type: "user_message";
  message?: Record<string, unknown>;
  content?: string;
  prompt?: string;
}

export interface AssistantTextMsg extends BaseMessage {
  type: "assistant_text";
  text: string;
}

export interface ResultMsg extends BaseMessage {
  type: "result";
  text?: string;
  is_error?: boolean;
  cost?: number;
  duration_ms?: number;
  mode?: "normal" | "plan";
  planExecuted?: boolean;
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
  model?: string;
  session_id?: string;
}

export interface ToolUseMsg extends BaseMessage {
  type: "tool_use";
  tool: string;
  input?: Record<string, unknown>;
  tool_use_id: string;
  status?: "running" | "done" | "error";
  output?: string;
  is_error?: boolean;
  is_truncated?: boolean;
  full_length?: number;
  completed_at?: string;
}

export interface ToolResultMsg extends BaseMessage {
  type: "tool_result";
  tool_use_id?: string;
  output?: string;
  is_error?: boolean;
  is_truncated?: boolean;
  full_length?: number;
}

export interface FileChangeMsg extends BaseMessage {
  type: "file_change";
  change: FileChange;
}

export interface ErrorMsg extends BaseMessage {
  type: "error";
  message?: string;
  text?: string;
}

export interface StderrMsg extends BaseMessage {
  type: "stderr";
  text: string;
}

export interface SystemMsg extends BaseMessage {
  type: "system";
  text: string;
}

export interface EventMsg extends BaseMessage {
  type: "event";
  event: Record<string, unknown>;
}

export interface ThinkingMsg extends BaseMessage {
  type: "thinking";
  text: string;
}

export interface PermissionRequestMsg extends BaseMessage {
  type: "permission_request";
  tool: string;
  input?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// AskUserQuestion: Claude CLI가 사용자에게 질문할 때 사용
// ---------------------------------------------------------------------------
export interface AskUserQuestionOption {
  label: string;
  description?: string;
}

export interface AskUserQuestionItem {
  question: string;
  header?: string;
  options: AskUserQuestionOption[];
  multiSelect?: boolean;
}

export interface AskUserQuestionMsg extends BaseMessage {
  type: "ask_user_question";
  questions: AskUserQuestionItem[];
  tool_use_id: string;
  /** 각 질문에 대한 사용자 답변 (question index → 선택된 label 배열) */
  answers?: Record<number, string[]>;
  /** 사용자가 답변을 확인(confirm) 완료했는지 여부 */
  answered?: boolean;
  /** 답변이 다음 프롬프트에 포함되어 전송되었는지 여부 */
  sent?: boolean;
}

// ---------------------------------------------------------------------------
// Message: discriminated union of all message types
// ---------------------------------------------------------------------------
export type Message =
  | UserMsg
  | AssistantTextMsg
  | ResultMsg
  | ToolUseMsg
  | ToolResultMsg
  | FileChangeMsg
  | ErrorMsg
  | StderrMsg
  | SystemMsg
  | EventMsg
  | ThinkingMsg
  | PermissionRequestMsg
  | AskUserQuestionMsg;

/** Convenience alias: the discriminant values */
export type MessageType = Message["type"];

// ---------------------------------------------------------------------------
// MessageUpdate: fields that can be patched via updateMessage()
// ---------------------------------------------------------------------------
export type MessageUpdate = {
  planExecuted?: boolean;
  status?: "running" | "done" | "error";
  completed_at?: string;
  output?: string;
  is_error?: boolean;
  is_truncated?: boolean;
  full_length?: number;
  text?: string;
};

// ---------------------------------------------------------------------------
// Helper: extract display text from any message variant
// ---------------------------------------------------------------------------
export function getMessageText(msg: Message): string {
  switch (msg.type) {
    case "assistant_text":
    case "stderr":
    case "system":
    case "thinking":
      return msg.text || "";
    case "result":
      return msg.text || "";
    case "error":
      return msg.message || msg.text || "";
    case "user_message":
      return msg.content || msg.prompt || "";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// WebSocket event types (backend → frontend)
// ---------------------------------------------------------------------------
export type WebSocketEventType =
  | "session_state"
  | "session_info"
  | "status"
  | "user_message"
  | "assistant_text"
  | "tool_use"
  | "tool_result"
  | "file_change"
  | "result"
  | "error"
  | "stderr"
  | "stopped"
  | "event"
  | "raw"
  | "thinking"
  | "permission_request"
  | "permission_response"
  | "missed_events"
  | "mode_change"
  | "ask_user_question";

export interface PermissionRequestData {
  permission_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  timestamp?: string;
}

export interface WebSocketEvent {
  type: WebSocketEventType;
  [key: string]: unknown;
}
