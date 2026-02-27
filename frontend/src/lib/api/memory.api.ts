/**
 * Claude Code Memory API 클라이언트.
 */
import { api } from "./client";
import type { MemoryFileInfo, MemoryFileContent, MemoryContextResponse } from "@/types/claude-memory";

export const memoryApi = {
  listFiles: (workspaceId: string) =>
    api.get<MemoryFileInfo[]>(`/api/workspaces/${workspaceId}/memory/files/`),

  readFile: (workspaceId: string, filePath: string) =>
    api.get<MemoryFileContent>(`/api/workspaces/${workspaceId}/memory/files/${filePath}`),

  context: (workspaceId: string) =>
    api.get<MemoryContextResponse>(`/api/workspaces/${workspaceId}/memory/context/`),
};
