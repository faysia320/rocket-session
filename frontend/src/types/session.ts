import type { TagInfo } from "./tag";
import type { WorkflowPhase, WorkflowPhaseStatus } from "./workflow";

export type SessionStatus = "idle" | "running" | "error" | "archived";

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
  workflow_enabled?: boolean;
  workflow_phase?: WorkflowPhase | null;
  workflow_phase_status?: WorkflowPhaseStatus | null;
  permission_mode?: boolean;
  permission_required_tools?: string[];
  name?: string;
  model?: string | null;
  max_turns?: number | null;
  max_budget_usd?: number | null;
  system_prompt_mode?: string | null;
  disallowed_tools?: string | null;
  mcp_server_ids?: string[] | null;
  additional_dirs?: string[] | null;
  fallback_model?: string | null;
  workspace_id?: string | null;
  worktree_name?: string | null;
  parent_session_id?: string | null;
  forked_at_message_id?: number | null;
  tags?: TagInfo[];
  current_activity?: CurrentActivity | null;
}

export interface CreateSessionRequest {
  work_dir?: string | null;
  allowed_tools?: string | null;
  system_prompt?: string | null;
  timeout_seconds?: number | null;
  workflow_enabled?: boolean | null;
  permission_mode?: boolean | null;
  permission_required_tools?: string[] | null;
  model?: string | null;
  max_turns?: number | null;
  max_budget_usd?: number | null;
  system_prompt_mode?: string | null;
  disallowed_tools?: string | null;
  mcp_server_ids?: string[] | null;
  additional_dirs?: string[] | null;
  fallback_model?: string | null;
  worktree_name?: string | null;
  workspace_id?: string | null;
}

export interface UpdateSessionRequest {
  allowed_tools?: string | null;
  system_prompt?: string | null;
  timeout_seconds?: number | null;
  workflow_enabled?: boolean | null;
  permission_mode?: boolean | null;
  permission_required_tools?: string[] | null;
  name?: string | null;
  model?: string | null;
  max_turns?: number | null;
  max_budget_usd?: number | null;
  system_prompt_mode?: string | null;
  disallowed_tools?: string | null;
  mcp_server_ids?: string[] | null;
  additional_dirs?: string[] | null;
  fallback_model?: string | null;
  work_dir?: string | null;
}

export interface ConvertToWorktreeRequest {
  worktree_name: string;
}

export interface SessionStats {
  total_messages: number;
  total_cost: number;
  total_duration_ms: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_creation_tokens: number;
  total_cache_read_tokens: number;
}
