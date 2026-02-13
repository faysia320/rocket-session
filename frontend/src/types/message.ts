export type MessageType =
  | 'user_message'
  | 'assistant_text'
  | 'result'
  | 'tool_use'
  | 'tool_result'
  | 'file_change'
  | 'error'
  | 'stderr'
  | 'system'
  | 'event'
  | 'permission_request';

export interface FileChange {
  tool: string;
  file: string;
  timestamp?: string;
}

export interface Message {
  id: string;
  type: MessageType;
  seq?: number;
  text?: string;
  message?: string;
  content?: string;
  prompt?: string;
  tool?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  output?: string;
  is_error?: boolean;
  status?: 'running' | 'done' | 'error';
  change?: FileChange;
  event?: Record<string, unknown>;
  cost?: number;
  duration_ms?: number;
  is_truncated?: boolean;
  full_length?: number;
  timestamp?: string;
  mode?: 'normal' | 'plan';
  planExecuted?: boolean;
}

export type WebSocketEventType =
  | 'session_state'
  | 'session_info'
  | 'status'
  | 'user_message'
  | 'assistant_text'
  | 'tool_use'
  | 'tool_result'
  | 'file_change'
  | 'result'
  | 'error'
  | 'stderr'
  | 'stopped'
  | 'event'
  | 'permission_request'
  | 'permission_response'
  | 'missed_events';

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
