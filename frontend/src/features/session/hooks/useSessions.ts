import { useCallback, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sessionsApi } from "@/lib/api/sessions.api";
import { useOptimisticMutation } from "@/lib/hooks/useOptimisticMutation";
import { sessionKeys } from "./sessionKeys";
import type { SessionInfo, SessionStatus } from "@/types";
import { useSessionStore } from "@/store/useSessionStore";

/** Split Mode에서 삭제/아카이브 후 이동할 경로를 결정한다. */
function getPostDeleteTarget(
  deletedId: string,
  pathname: string,
  queryClient: QueryClient,
): string | null {
  if (!pathname.includes(deletedId)) return null;

  if (useSessionStore.getState().viewMode === "split") {
    const sessions = queryClient.getQueryData<SessionInfo[]>(sessionKeys.list()) ?? [];
    const remaining = sessions.filter((s) => s.id !== deletedId && s.status !== "archived");
    if (remaining.length > 0) {
      return `/session/${remaining[0].id}`;
    }
  }

  useSessionStore.getState().setViewMode("dashboard");
  return "/";
}

/**
 * 세션 생성 전용 훅.
 * 라우트 컴포넌트에서 독립적으로 사용 가능.
 */
export function useCreateSession() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (params: {
      workDir?: string;
      options?: {
        system_prompt?: string;

        additional_dirs?: string[];
        worktree_name?: string;
        workspace_id?: string;
        workflow_definition_id?: string;
      };
    }) => sessionsApi.create(params.workDir, params.options),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      navigate({
        to: "/session/$sessionId",
        params: { sessionId: session.id },
      });
    },
  });

  const createSession = useCallback(
    async (
      workDir?: string,
      options?: {
        system_prompt?: string;

        additional_dirs?: string[];
        worktree_name?: string;
        workspace_id?: string;
        workflow_definition_id?: string;
      },
    ) => {
      return mutation.mutateAsync({ workDir, options });
    },
    [mutation],
  );

  return { createSession };
}

/**
 * 세션 관리 훅 - TanStack Query 기반 세션 목록, 삭제, 선택 로직.
 */
export function useSessions() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const {
    data: sessions = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: sessionKeys.list(),
    queryFn: () => sessionsApi.list(),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  // Running 세션이 있을 때 5초 간격 자동 갱신 (활동 내용 반영)
  const hasRunning = sessions.some((s) => s.status === "running");
  useEffect(() => {
    if (!hasRunning) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.list() });
    }, 5_000);
    return () => clearInterval(interval);
  }, [hasRunning, queryClient]);

  const deleteMutation = useOptimisticMutation<SessionInfo[], string>({
    mutationFn: (id) => sessionsApi.delete(id),
    queryKey: sessionKeys.list(),
    updater: (old, id) => old?.filter((s) => s.id !== id) ?? [],
    errorMessage: "세션 삭제에 실패했습니다",
  });

  const deleteSession = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id);
      const target = getPostDeleteTarget(id, location.pathname, queryClient);
      if (target) navigate({ to: target });
    },
    [deleteMutation, navigate, location.pathname, queryClient],
  );

  const selectSession = useCallback(
    (id: string) => {
      navigate({ to: "/session/$sessionId", params: { sessionId: id } });
    },
    [navigate],
  );

  const renameMutation = useOptimisticMutation<SessionInfo[], { id: string; name: string }>({
    mutationFn: ({ id, name }) => sessionsApi.update(id, { name }),
    queryKey: sessionKeys.list(),
    updater: (old, { id, name }) => old?.map((s) => (s.id === id ? { ...s, name } : s)) ?? [],
    errorMessage: "세션 이름 변경에 실패했습니다",
    invalidateKey: sessionKeys.all,
  });

  const renameSession = useCallback(
    async (id: string, name: string) => {
      await renameMutation.mutateAsync({ id, name });
    },
    [renameMutation],
  );

  const archiveMutation = useOptimisticMutation<SessionInfo[], string>({
    mutationFn: (id) => sessionsApi.archive(id),
    queryKey: sessionKeys.list(),
    updater: (old, id) =>
      old?.map((s) => (s.id === id ? { ...s, status: "archived" as SessionStatus } : s)) ?? [],
    errorMessage: "세션 보관에 실패했습니다",
  });

  const archiveSession = useCallback(
    async (id: string) => {
      await archiveMutation.mutateAsync(id);
      const target = getPostDeleteTarget(id, location.pathname, queryClient);
      if (target) navigate({ to: target });
    },
    [archiveMutation, navigate, location.pathname, queryClient],
  );

  const unarchiveMutation = useOptimisticMutation<SessionInfo[], string>({
    mutationFn: (id) => sessionsApi.unarchive(id),
    queryKey: sessionKeys.list(),
    updater: (old, id) =>
      old?.map((s) => (s.id === id ? { ...s, status: "idle" as SessionStatus } : s)) ?? [],
    errorMessage: "세션 보관 해제에 실패했습니다",
  });

  const unarchiveSession = useCallback(
    async (id: string) => {
      await unarchiveMutation.mutateAsync(id);
    },
    [unarchiveMutation],
  );

  const refreshSessions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: sessionKeys.list() });
  }, [queryClient]);

  const activeSessionId = useMemo(
    () => extractSessionIdFromPath(location.pathname),
    [location.pathname],
  );

  return {
    sessions,
    activeSessionId,
    isLoading,
    isError,
    deleteSession,
    renameSession,
    selectSession,
    refreshSessions,
    archiveSession,
    unarchiveSession,
  };
}

/**
 * 세션 mutation 전용 훅 (목록 구독 없이 archive/unarchive만 사용).
 * ChatPanel 등 자식 컴포넌트에서 useSessions() 중복 호출(+ 5초 polling 다중 생성)을 방지.
 */
export function useSessionMutations() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onError: () => {
      toast.error("세션 삭제에 실패했습니다");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.list() });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.archive(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.list() });
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.unarchive(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.list() });
    },
  });

  const deleteSession = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id);
      const target = getPostDeleteTarget(id, location.pathname, queryClient);
      if (target) navigate({ to: target });
    },
    [deleteMutation, navigate, location.pathname, queryClient],
  );

  const archiveSession = useCallback(
    async (id: string) => {
      await archiveMutation.mutateAsync(id);
      const target = getPostDeleteTarget(id, location.pathname, queryClient);
      if (target) navigate({ to: target });
    },
    [archiveMutation, navigate, location.pathname, queryClient],
  );

  const unarchiveSession = useCallback(
    async (id: string) => {
      await unarchiveMutation.mutateAsync(id);
    },
    [unarchiveMutation],
  );

  return { deleteSession, archiveSession, unarchiveSession };
}

function extractSessionIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/session\/([^/]+)/);
  if (!match || match[1] === "new") return null;
  return match[1];
}
