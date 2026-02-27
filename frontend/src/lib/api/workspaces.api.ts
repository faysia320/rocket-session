import type {
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  WorkspaceInfo,
  WorkspaceSyncRequest,
  WorkspaceSyncResponse,
} from "@/types/workspace";
import { api } from "./client";

export const workspacesApi = {
  list: () => api.get<WorkspaceInfo[]>("/api/workspaces/"),

  create: (data: CreateWorkspaceRequest) =>
    api.post<WorkspaceInfo>("/api/workspaces/", data, 10000),

  get: (id: string) => api.get<WorkspaceInfo>(`/api/workspaces/${id}`),

  update: (id: string, data: UpdateWorkspaceRequest) =>
    api.patch<WorkspaceInfo>(`/api/workspaces/${id}`, data),

  delete: (id: string) => api.delete<void>(`/api/workspaces/${id}`),

  sync: (id: string, data: WorkspaceSyncRequest) =>
    api.post<WorkspaceSyncResponse>(`/api/workspaces/${id}/sync`, data, 120000),
};
