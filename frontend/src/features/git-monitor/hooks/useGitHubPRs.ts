import { useQuery } from "@tanstack/react-query";
import { filesystemApi } from "@/lib/api/filesystem.api";
import type { GitHubCLIStatus, GitHubPRListResponse } from "@/types";

export function useGhStatus(repoPath: string) {
  return useQuery<GitHubCLIStatus>({
    queryKey: ["gh-status", repoPath],
    queryFn: () => filesystemApi.getGhStatus(repoPath),
    enabled: repoPath.length > 0,
    staleTime: 60_000,
    retry: false,
  });
}

export function useGitHubPRs(
  repoPath: string,
  state = "open",
  enabled = true,
) {
  return useQuery<GitHubPRListResponse>({
    queryKey: ["gh-prs", repoPath, state],
    queryFn: () => filesystemApi.getGitHubPRs(repoPath, state),
    enabled: enabled && repoPath.length > 0,
    staleTime: 30_000,
  });
}
