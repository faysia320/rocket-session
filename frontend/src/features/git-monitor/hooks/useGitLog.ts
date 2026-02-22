import { useQuery } from "@tanstack/react-query";
import { filesystemApi } from "@/lib/api/filesystem.api";
import type { GitLogResponse } from "@/types";

interface UseGitLogParams {
  limit?: number;
  offset?: number;
  author?: string;
  since?: string;
  until?: string;
  search?: string;
}

export function useGitLog(repoPath: string, params: UseGitLogParams = {}) {
  return useQuery<GitLogResponse>({
    queryKey: ["git-log", repoPath, params],
    queryFn: () => filesystemApi.getGitLog(repoPath, params),
    enabled: repoPath.length > 0,
    staleTime: 30_000,
  });
}
