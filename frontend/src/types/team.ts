/**
 * 팀 관련 타입 정의.
 */

export interface TeamMemberInfo {
  id: number;
  team_id: string;
  session_id: string;
  role: "lead" | "member";
  nickname: string | null;
  joined_at: string;
  session_status: string | null;
  session_name: string | null;
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
  lead_session_id: string | null;
  work_dir: string;
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
  lead_session_id: string | null;
  work_dir: string;
  created_at: string;
  updated_at: string;
  member_count: number;
  task_summary: TaskSummary;
}

export interface CreateTeamRequest {
  name: string;
  work_dir: string;
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
  session_id: string;
  role?: "lead" | "member";
  nickname?: string;
}

export interface CreateMemberSessionRequest {
  nickname?: string;
  role?: "lead" | "member";
  allowed_tools?: string;
  system_prompt?: string;
  model?: string;
  max_turns?: number;
}

export interface SetLeadRequest {
  session_id: string;
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
  assigned_session_id: string | null;
  assigned_nickname: string | null;
  created_by_session_id: string | null;
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
  assigned_session_id?: string;
  depends_on_task_id?: number;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_session_id?: string;
  order_index?: number;
}

export interface CompleteTaskRequest {
  result_summary?: string;
}

export interface DelegateTaskRequest {
  target_session_id: string;
  prompt?: string;
}

// ── 메시지 ──

export type TeamMessageType = "info" | "task_update" | "request" | "result" | "delegate";

export interface TeamMessageInfo {
  id: number;
  team_id: string;
  from_session_id: string;
  to_session_id: string | null;
  content: string;
  message_type: TeamMessageType;
  metadata_json: string | null;
  is_read: boolean;
  created_at: string;
  from_nickname: string | null;
}

export interface SendMessageRequest {
  content: string;
  to_session_id?: string;
  message_type?: TeamMessageType;
  metadata_json?: string;
}

export interface MarkReadRequest {
  message_ids: number[];
}
