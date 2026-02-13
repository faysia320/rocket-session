export type MessageType =
  | 'user_message'
  | 'assistant_text'
  | 'result'
  | 'tool_use'
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
  type: MessageType;
  text?: string;
  message?: string;
  content?: string;
  prompt?: string;
  tool?: string;
  input?: Record<string, unknown>;
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
