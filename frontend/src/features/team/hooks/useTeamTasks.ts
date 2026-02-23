import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { teamsApi } from "@/lib/api/teams.api";
import { teamKeys } from "./teamKeys";
import type {
  TeamTaskInfo,
  CreateTaskRequest,
  UpdateTaskRequest,
  CompleteTaskRequest,
} from "@/types";

/**
 * 팀 태스크 목록 + CRUD 훅.
 */
export function useTeamTasks(teamId: string, status?: string) {
  const queryClient = useQueryClient();

  const {
    data: tasks = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: teamKeys.tasks(teamId, status),
    queryFn: () => teamsApi.listTasks(teamId, status),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });

  const invalidateTasks = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: teamKeys.tasks(teamId) });
    queryClient.invalidateQueries({ queryKey: teamKeys.detail(teamId) });
    queryClient.invalidateQueries({ queryKey: teamKeys.list() });
  }, [queryClient, teamId]);

  // 태스크 생성
  const createMutation = useMutation({
    mutationFn: (data: CreateTaskRequest) => teamsApi.createTask(teamId, data),
    onSuccess: () => {
      invalidateTasks();
      toast.success("태스크가 생성되었습니다");
    },
    onError: (err: Error) => {
      toast.error(`태스크 생성 실패: ${err.message}`);
    },
  });

  // 태스크 수정
  const updateMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: UpdateTaskRequest }) =>
      teamsApi.updateTask(teamId, taskId, data),
    onSuccess: () => {
      invalidateTasks();
    },
    onError: (err: Error) => {
      toast.error(`태스크 수정 실패: ${err.message}`);
    },
  });

  // 태스크 삭제
  const deleteMutation = useMutation({
    mutationFn: (taskId: number) => teamsApi.deleteTask(teamId, taskId),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: teamKeys.tasks(teamId) });
      const prev = queryClient.getQueryData<TeamTaskInfo[]>(teamKeys.tasks(teamId));
      queryClient.setQueryData<TeamTaskInfo[]>(
        teamKeys.tasks(teamId),
        (old) => old?.filter((t) => t.id !== taskId) ?? [],
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(teamKeys.tasks(teamId), ctx.prev);
      }
      toast.error("태스크 삭제 실패");
    },
    onSettled: () => {
      invalidateTasks();
    },
  });

  // 태스크 선점
  const claimMutation = useMutation({
    mutationFn: ({ taskId, sessionId }: { taskId: number; sessionId: string }) =>
      teamsApi.claimTask(teamId, taskId, sessionId),
    onSuccess: () => {
      invalidateTasks();
      toast.success("태스크가 할당되었습니다");
    },
    onError: (err: Error) => {
      toast.error(`태스크 할당 실패: ${err.message}`);
    },
  });

  // 태스크 완료
  const completeMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data?: CompleteTaskRequest }) =>
      teamsApi.completeTask(teamId, taskId, data),
    onSuccess: () => {
      invalidateTasks();
      toast.success("태스크가 완료되었습니다");
    },
    onError: (err: Error) => {
      toast.error(`태스크 완료 실패: ${err.message}`);
    },
  });

  // 순서 변경
  const reorderMutation = useMutation({
    mutationFn: (taskIds: number[]) => teamsApi.reorderTasks(teamId, taskIds),
    onError: (err: Error) => {
      toast.error(`순서 변경 실패: ${err.message}`);
      invalidateTasks();
    },
  });

  // 상태별 그룹핑
  const tasksByStatus = {
    pending: tasks.filter((t) => t.status === "pending"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    completed: tasks.filter((t) => t.status === "completed" || t.status === "failed" || t.status === "cancelled"),
  };

  return {
    tasks,
    tasksByStatus,
    isLoading,
    isError,
    createTask: createMutation.mutateAsync,
    updateTask: updateMutation.mutateAsync,
    deleteTask: deleteMutation.mutate,
    claimTask: claimMutation.mutateAsync,
    completeTask: completeMutation.mutateAsync,
    reorderTasks: reorderMutation.mutateAsync,
    isCreating: createMutation.isPending,
    invalidateTasks,
  };
}
