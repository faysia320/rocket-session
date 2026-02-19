/**
 * MCP 서버 도메인 API 함수.
 */
import { api } from "./client";
import type {
  McpServerInfo,
  CreateMcpServerRequest,
  UpdateMcpServerRequest,
  SystemMcpServer,
} from "@/types";

export const mcpApi = {
  list: () => api.get<McpServerInfo[]>("/api/mcp/"),

  get: (id: string) => api.get<McpServerInfo>(`/api/mcp/${id}`),

  create: (data: CreateMcpServerRequest) =>
    api.post<McpServerInfo>("/api/mcp/", data),

  update: (id: string, data: UpdateMcpServerRequest) =>
    api.patch<McpServerInfo>(`/api/mcp/${id}`, data),

  delete: (id: string) => api.delete<void>(`/api/mcp/${id}`),

  systemServers: () =>
    api.get<SystemMcpServer[]>("/api/mcp/system-servers"),

  importSystem: (names?: string[]) =>
    api.post<McpServerInfo[]>("/api/mcp/import-system", { names: names ?? null }),
};
