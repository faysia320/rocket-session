import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { filesystemApi } from "@/lib/api/filesystem.api";
import type { GitInfo } from "@/types";

export function useGitInfo(path: string) {
  const [debouncedPath, setDebouncedPath] = useState(path);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPath(path), 500);
    return () => clearTimeout(timer);
  }, [path]);

  const { data: gitInfo, isLoading } = useQuery<GitInfo>({
    queryKey: ["git-info", debouncedPath],
    queryFn: () => filesystemApi.getGitInfo(debouncedPath),
    enabled: debouncedPath.length > 0,
    retry: false,
    staleTime: 30_000,
  });

  return { gitInfo: gitInfo ?? null, isLoading };
}
