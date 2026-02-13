export type SessionStatus = 'idle' | 'running' | 'error' | 'stopped';

export interface SessionInfo {
  id: string;
  status: SessionStatus;
  work_dir: string;
  message_count: number;
  file_changes_count: number;
  claude_session_id?: string;
  created_at?: string;
}

export interface CreateSessionRequest {
  work_dir?: string | null;
}
