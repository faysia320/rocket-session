import { useQuery } from "@tanstack/react-query";
import { filesystemApi } from "@/lib/api/filesystem.api";
import type { GitInfo } from "@/types";

export function useGitInfo(path: string) {
  const { data: gitInfo, isLoading } = useQuery<GitInfo>({
    queryKey: ["git-info", path],
    queryFn: () => filesystemApi.getGitInfo(path),
    enabled: path.length > 0,
    retry: false,
    staleTime: 30_000,
  });

  return { gitInfo: gitInfo ?? null, isLoading };
}
