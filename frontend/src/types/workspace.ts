export type WorkspaceStatus = "cloning" | "ready" | "error" | "deleting";

export interface ValidationCommand {
  name: string;
  command: string;
  run_on: string[];
  timeout_seconds: number;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  repo_url: string;
  branch?: string | null;
  local_path: string;
  status: WorkspaceStatus;
  error_message?: string | null;
  disk_usage_mb?: number | null;
  last_synced_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  validation_commands?: ValidationCommand[] | null;
  current_branch?: string | null;
  is_dirty?: boolean | null;
  ahead?: number | null;
  behind?: number | null;
}

export interface CreateWorkspaceRequest {
  repo_url: string;
  branch?: string | null;
  name?: string | null;
}

export interface UpdateWorkspaceRequest {
  name?: string | null;
  validation_commands?: ValidationCommand[] | null;
}

export interface WorkspaceSyncRequest {
  action: "pull" | "push";
  force?: boolean;
}

export interface WorkspaceSyncResponse {
  success: boolean;
  message: string;
  commit_hash?: string | null;
}
