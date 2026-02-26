import { api } from "./client";
import type {
  WorkflowNodeInfo,
  CreateWorkflowNodeRequest,
  UpdateWorkflowNodeRequest,
} from "@/types/workflow";

const BASE = "/api/workflow-nodes";

export const workflowNodeApi = {
  list: () => api.get<WorkflowNodeInfo[]>(`${BASE}/`),

  get: (id: string) => api.get<WorkflowNodeInfo>(`${BASE}/${id}`),

  create: (req: CreateWorkflowNodeRequest) =>
    api.post<WorkflowNodeInfo>(`${BASE}/`, req),

  update: (id: string, req: UpdateWorkflowNodeRequest) =>
    api.patch<WorkflowNodeInfo>(`${BASE}/${id}`, req),

  delete: (id: string) => api.delete<void>(`${BASE}/${id}`),
};
