import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { filesystemApi } from '@/lib/api/filesystem.api';
import type { CreateWorktreeRequest } from '@/types';

export function useWorktrees(repoPath: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['worktrees', repoPath],
    queryFn: () => filesystemApi.listWorktrees(repoPath!),
    enabled: !!repoPath,
    retry: false,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (req: CreateWorktreeRequest) => filesystemApi.createWorktree(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worktrees', repoPath] });
    },
  });

  return {
    worktrees: data?.worktrees ?? [],
    isLoading,
    createWorktree: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}
