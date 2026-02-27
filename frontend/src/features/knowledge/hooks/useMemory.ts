import { useQuery } from "@tanstack/react-query";
import { memoryApi } from "@/lib/api/memory.api";

export const memoryKeys = {
  all: ["memory"] as const,
  files: (workspaceId: string) => [...memoryKeys.all, "files", workspaceId] as const,
  file: (workspaceId: string, filePath: string) =>
    [...memoryKeys.all, "file", workspaceId, filePath] as const,
};

export function useMemoryFiles(workspaceId: string | null) {
  return useQuery({
    queryKey: memoryKeys.files(workspaceId ?? ""),
    queryFn: () => memoryApi.listFiles(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
}

export function useMemoryFileContent(workspaceId: string | null, filePath: string | null) {
  return useQuery({
    queryKey: memoryKeys.file(workspaceId ?? "", filePath ?? ""),
    queryFn: () => memoryApi.readFile(workspaceId!, filePath!),
    enabled: !!workspaceId && !!filePath,
    staleTime: 60_000,
  });
}
