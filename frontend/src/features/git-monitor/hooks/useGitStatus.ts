import { useQuery } from "@tanstack/react-query";
import { filesystemApi } from "@/lib/api/filesystem.api";
import type { GitStatusResponse } from "@/types";

/** Git 변경 파일 목록 폴링 훅 (30초 간격 자동 갱신). */
export function useGitStatus(repoPath: string) {
  return useQuery<GitStatusResponse>({
    queryKey: ["git-status", repoPath],
    queryFn: () => filesystemApi.getGitStatus(repoPath),
    enabled: repoPath.length > 0,
    staleTime: 25_000,
    refetchInterval: 30_000,
  });
}
