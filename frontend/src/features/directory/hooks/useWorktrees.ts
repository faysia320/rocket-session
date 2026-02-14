import { useQuery } from "@tanstack/react-query";
import { filesystemApi } from "@/lib/api/filesystem.api";

export function useWorktrees(repoPath: string | null) {
  const { data, isLoading } = useQuery({
    queryKey: ["worktrees", repoPath],
    queryFn: () => filesystemApi.listWorktrees(repoPath!),
    enabled: !!repoPath,
    retry: false,
    staleTime: 30_000,
  });

  return {
    worktrees: data?.worktrees ?? [],
    isLoading,
  };
}
