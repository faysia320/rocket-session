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
  | 'event';

export interface FileChange {
  tool: string;
  file: string;
  timestamp?: string;
}

export interface Message {
  id: string;
  type: MessageType;
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
  timestamp?: string;
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
  | 'event';

export interface WebSocketEvent {
  type: WebSocketEventType;
  [key: string]: unknown;
}
