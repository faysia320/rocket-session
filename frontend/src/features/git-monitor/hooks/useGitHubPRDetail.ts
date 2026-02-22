import { useQuery } from "@tanstack/react-query";
import { filesystemApi } from "@/lib/api/filesystem.api";
import type { GitHubPRDetail } from "@/types";

export function useGitHubPRDetail(
  repoPath: string,
  prNumber: number | null,
) {
  return useQuery<GitHubPRDetail>({
    queryKey: ["gh-pr-detail", repoPath, prNumber],
    queryFn: () => filesystemApi.getGitHubPRDetail(repoPath, prNumber!),
    enabled: repoPath.length > 0 && prNumber !== null,
    staleTime: 30_000,
  });
}
