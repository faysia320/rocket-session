import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { filesystemApi } from "@/lib/api/filesystem.api";
import { toast } from "sonner";

/** 로컬 브랜치 목록 조회. */
export function useGitBranches(repoPath: string) {
  return useQuery({
    queryKey: ["git-branches", repoPath],
    queryFn: () => filesystemApi.listGitBranches(repoPath),
    enabled: repoPath.length > 0,
    staleTime: 30_000,
  });
}

/** 브랜치 체크아웃. */
export function useCheckoutBranch(repoPath: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branch: string) =>
      filesystemApi.checkoutGitBranch(repoPath, branch),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["git-branches", repoPath] });
      queryClient.invalidateQueries({ queryKey: ["git-status", repoPath] });
      queryClient.invalidateQueries({ queryKey: ["git-info"] });
      queryClient.invalidateQueries({ queryKey: ["git-log", repoPath] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: () => {
      toast.error("브랜치 전환에 실패했습니다");
    },
  });
}

/** Stage All + Commit (수동 커밋). */
export function useStageAndCommit(repoPath: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (message: string) => {
      await filesystemApi.stageGitFiles(repoPath);
      return filesystemApi.commitGit(repoPath, message);
    },
    onSuccess: (data) => {
      toast.success(`커밋 완료: ${data.commit_hash}`);
      queryClient.invalidateQueries({ queryKey: ["git-status", repoPath] });
      queryClient.invalidateQueries({ queryKey: ["git-info"] });
      queryClient.invalidateQueries({ queryKey: ["git-log", repoPath] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: () => {
      toast.error("커밋에 실패했습니다");
    },
  });
}
