export type SessionStatus = "idle" | "running" | "error" | "stopped";
export type SessionMode = "normal" | "plan";

export interface CurrentActivity {
  tool: string;
  input?: Record<string, unknown>;
}

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
  mode?: SessionMode;
  permission_mode?: boolean;
  permission_required_tools?: string[];
  name?: string;
  model?: string | null;
  max_turns?: number | null;
  max_budget_usd?: number | null;
  system_prompt_mode?: string | null;
  disallowed_tools?: string | null;
  mcp_server_ids?: string[] | null;
  current_activity?: CurrentActivity | null;
}

export interface CreateSessionRequest {
  work_dir?: string | null;
  allowed_tools?: string | null;
  system_prompt?: string | null;
  timeout_seconds?: number | null;
  mode?: SessionMode | null;
  permission_mode?: boolean | null;
  permission_required_tools?: string[] | null;
  model?: string | null;
  max_turns?: number | null;
  max_budget_usd?: number | null;
  system_prompt_mode?: string | null;
  disallowed_tools?: string | null;
  mcp_server_ids?: string[] | null;
}

export interface UpdateSessionRequest {
  allowed_tools?: string | null;
  system_prompt?: string | null;
  timeout_seconds?: number | null;
  mode?: SessionMode | null;
  permission_mode?: boolean | null;
  permission_required_tools?: string[] | null;
  name?: string | null;
  model?: string | null;
  max_turns?: number | null;
  max_budget_usd?: number | null;
  system_prompt_mode?: string | null;
  disallowed_tools?: string | null;
  mcp_server_ids?: string[] | null;
}
