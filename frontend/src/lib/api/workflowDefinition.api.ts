import { api } from "./client";
import type {
  WorkflowDefinitionInfo,
  CreateWorkflowDefinitionRequest,
  UpdateWorkflowDefinitionRequest,
  WorkflowDefinitionExport,
} from "@/types/workflow";

const BASE = "/api/workflow-definitions";

export const workflowDefinitionApi = {
  list: () => api.get<WorkflowDefinitionInfo[]>(`${BASE}/`),

  get: (id: string) => api.get<WorkflowDefinitionInfo>(`${BASE}/${id}`),

  create: (req: CreateWorkflowDefinitionRequest) =>
    api.post<WorkflowDefinitionInfo>(`${BASE}/`, req),

  update: (id: string, req: UpdateWorkflowDefinitionRequest) =>
    api.patch<WorkflowDefinitionInfo>(`${BASE}/${id}`, req),

  delete: (id: string) => api.delete<void>(`${BASE}/${id}`),

  export: (id: string) => api.get<WorkflowDefinitionExport>(`${BASE}/${id}/export`),

  import: (data: WorkflowDefinitionExport) =>
    api.post<WorkflowDefinitionInfo>(`${BASE}/import`, data),

  setDefault: (id: string) => api.post<WorkflowDefinitionInfo>(`${BASE}/${id}/set-default`),
};
