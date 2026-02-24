export type WorkspaceStatus = "cloning" | "ready" | "error" | "deleting";

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
  auto_push: boolean;
  created_at: string;
  updated_at?: string | null;
  current_branch?: string | null;
  is_dirty?: boolean | null;
  ahead?: number | null;
  behind?: number | null;
}

export interface CreateWorkspaceRequest {
  repo_url: string;
  branch?: string | null;
  name?: string | null;
  auto_push?: boolean;
}

export interface UpdateWorkspaceRequest {
  name?: string | null;
  auto_push?: boolean | null;
}

export interface WorkspaceSyncRequest {
  action: "pull" | "push";
}

export interface WorkspaceSyncResponse {
  success: boolean;
  message: string;
  commit_hash?: string | null;
}
