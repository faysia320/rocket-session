export interface LocalSessionMeta {
  session_id: string;
  project_dir: string;
  cwd: string;
  git_branch: string | null;
  slug: string | null;
  version: string | null;
  first_timestamp: string | null;
  last_timestamp: string | null;
  file_size: number;
  message_count: number;
  already_imported: boolean;
}

export interface ImportLocalSessionRequest {
  session_id: string;
  project_dir: string;
}

export interface ImportLocalSessionResponse {
  dashboard_session_id: string;
  claude_session_id: string;
  messages_imported: number;
}
