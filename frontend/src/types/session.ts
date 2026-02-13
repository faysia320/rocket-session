export type SessionStatus = 'idle' | 'running' | 'error' | 'stopped';

export interface SessionInfo {
  id: string;
  status: SessionStatus;
  work_dir: string;
  message_count: number;
  file_changes_count: number;
  claude_session_id?: string;
  created_at?: string;
  allowed_tools?: string;
  system_prompt?: string;
  timeout_seconds?: number;
}

export interface CreateSessionRequest {
  work_dir?: string | null;
  allowed_tools?: string | null;
  system_prompt?: string | null;
  timeout_seconds?: number | null;
}

export interface UpdateSessionRequest {
  allowed_tools?: string | null;
  system_prompt?: string | null;
  timeout_seconds?: number | null;
}
