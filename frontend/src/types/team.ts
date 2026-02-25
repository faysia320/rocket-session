/**
 * 팀 관련 타입 정의.
 */

export interface TeamMemberInfo {
  id: number;
  team_id: string;
  role: "lead" | "member";
  nickname: string;
  description: string | null;
  system_prompt: string | null;
  allowed_tools: string | null;
  disallowed_tools: string | null;
  model: string | null;
  max_turns: number | null;
  max_budget_usd: number | null;
  mcp_server_ids: string[] | null;
  created_at: string;
  updated_at: string | null;
}

export interface TaskSummary {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
}

export interface TeamInfo {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "completed" | "paused" | "archived";
  lead_member_id: number | null;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  members: TeamMemberInfo[];
  task_summary: TaskSummary;
}

export interface TeamListItem {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "completed" | "paused" | "archived";
  lead_member_id: number | null;
  created_at: string;
  updated_at: string;
  member_count: number;
  task_summary: TaskSummary;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  config?: Record<string, unknown>;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  status?: "active" | "completed" | "paused" | "archived";
  config?: Record<string, unknown>;
}

export interface AddTeamMemberRequest {
  nickname: string;
  role?: "lead" | "member";
  description?: string;
  system_prompt?: string;
  allowed_tools?: string;
  disallowed_tools?: string;
  model?: string;
  max_turns?: number;
  max_budget_usd?: number;
  mcp_server_ids?: string[];
}

export interface UpdateTeamMemberRequest {
  nickname?: string;
  role?: "lead" | "member";
  description?: string;
  system_prompt?: string;
  allowed_tools?: string;
  disallowed_tools?: string;
  model?: string;
  max_turns?: number;
  max_budget_usd?: number;
  mcp_server_ids?: string[];
}

export interface SetLeadRequest {
  member_id: number;
}

// ── 태스크 ──

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";

export interface TeamTaskInfo {
  id: number;
  team_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_member_id: number | null;
  assigned_nickname: string | null;
  created_by_member_id: number | null;
  workspace_id: string | null;
  workspace_name: string | null;
  session_id: string | null;
  result_summary: string | null;
  order_index: number;
  depends_on_task_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: TaskPriority;
  workspace_id: string;
  assigned_member_id?: number;
  depends_on_task_id?: number;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  workspace_id?: string;
  assigned_member_id?: number;
  order_index?: number;
}

export interface CompleteTaskRequest {
  result_summary?: string;
}

export interface DelegateTaskRequest {
  member_id?: number;
  prompt?: string;
}

// ── 메시지 ──

export type TeamMessageType = "info" | "task_update" | "request" | "result" | "delegate";

export interface TeamMessageInfo {
  id: number;
  team_id: string;
  from_member_id: number;
  to_member_id: number | null;
  content: string;
  message_type: TeamMessageType;
  metadata_json: string | null;
  is_read: boolean;
  created_at: string;
  from_nickname: string | null;
}

export interface SendMessageRequest {
  from_member_id: number;
  content: string;
  to_member_id?: number;
  message_type?: TeamMessageType;
  metadata_json?: string;
}

export interface MarkReadRequest {
  message_ids: number[];
}
