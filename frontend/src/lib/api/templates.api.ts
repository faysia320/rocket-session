import { api } from "./client";
import type {
  TemplateInfo,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  CreateTemplateFromSessionRequest,
  TemplateExport,
} from "@/types";

/** 세션 템플릿 API */
export const templatesApi = {
  /** 템플릿 목록 조회 */
  list: () => api.get<TemplateInfo[]>("/api/templates/"),

  /** 단일 템플릿 조회 */
  get: (id: string) => api.get<TemplateInfo>(`/api/templates/${id}`),

  /** 새 템플릿 생성 */
  create: (data: CreateTemplateRequest) =>
    api.post<TemplateInfo>("/api/templates/", data),

  /** 템플릿 수정 */
  update: (id: string, data: UpdateTemplateRequest) =>
    api.patch<TemplateInfo>(`/api/templates/${id}`, data),

  /** 템플릿 삭제 */
  delete: (id: string) => api.delete<void>(`/api/templates/${id}`),

  /** 세션에서 템플릿 생성 */
  createFromSession: (sessionId: string, data: CreateTemplateFromSessionRequest) =>
    api.post<TemplateInfo>(`/api/templates/from-session/${sessionId}`, data),

  /** 템플릿 JSON export */
  export: (id: string) => api.get<TemplateExport>(`/api/templates/${id}/export`),

  /** 템플릿 JSON import */
  import: (data: TemplateExport) =>
    api.post<TemplateInfo>("/api/templates/import", data),
};
