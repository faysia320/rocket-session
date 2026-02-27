/**
 * 워크스페이스 인사이트(Knowledge Base) API 클라이언트.
 */
import { api } from "./client";
import type {
  WorkspaceInsightInfo,
  CreateInsightRequest,
  UpdateInsightRequest,
} from "@/types/knowledge";

export const insightsApi = {
  list: (workspaceId: string, params?: { category?: string; include_archived?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set("category", params.category);
    if (params?.include_archived) searchParams.set("include_archived", "true");
    const qs = searchParams.toString();
    return api.get<WorkspaceInsightInfo[]>(
      `/api/workspaces/${workspaceId}/insights/${qs ? `?${qs}` : ""}`,
    );
  },

  create: (workspaceId: string, data: CreateInsightRequest) =>
    api.post<WorkspaceInsightInfo>(`/api/workspaces/${workspaceId}/insights/`, data),

  update: (workspaceId: string, insightId: number, data: UpdateInsightRequest) =>
    api.put<WorkspaceInsightInfo>(`/api/workspaces/${workspaceId}/insights/${insightId}`, data),

  delete: (workspaceId: string, insightId: number) =>
    api.delete<{ status: string }>(`/api/workspaces/${workspaceId}/insights/${insightId}`),

  archive: (workspaceId: string, ids: number[]) =>
    api.post<{ status: string }>(`/api/workspaces/${workspaceId}/insights/archive`, { ids }),
};
