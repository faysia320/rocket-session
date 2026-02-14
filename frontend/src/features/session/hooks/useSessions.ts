import { useCallback } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sessionsApi } from '@/lib/api/sessions.api';
import { sessionKeys } from './sessionKeys';
import type { SessionInfo } from '@/types';

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
      options?: { allowed_tools?: string; system_prompt?: string; timeout_seconds?: number };
    }) => sessionsApi.create(params.workDir, params.options),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      navigate({ to: '/session/$sessionId', params: { sessionId: session.id } });
    },
  });

  const createSession = useCallback(
    async (
      workDir?: string,
      options?: { allowed_tools?: string; system_prompt?: string; timeout_seconds?: number },
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

  const { data: sessions = [], isLoading, isError } = useQuery({
    queryKey: sessionKeys.list(),
    queryFn: () => sessionsApi.list(),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: sessionKeys.list() });
      const previous = queryClient.getQueryData<SessionInfo[]>(sessionKeys.list());
      queryClient.setQueryData<SessionInfo[]>(sessionKeys.list(), (old) =>
        old?.filter((s) => s.id !== id) ?? [],
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(sessionKeys.list(), context.previous);
      }
      toast.error('세션 삭제에 실패했습니다');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
  });

  const deleteSession = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id);
      if (location.pathname.includes(id)) {
        navigate({ to: '/' });
      }
    },
    [deleteMutation, navigate, location.pathname],
  );

  const selectSession = useCallback(
    (id: string) => {
      navigate({ to: '/session/$sessionId', params: { sessionId: id } });
    },
    [navigate],
  );

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      sessionsApi.update(id, { name }),
    onMutate: async ({ id, name }) => {
      await queryClient.cancelQueries({ queryKey: sessionKeys.list() });
      const previous = queryClient.getQueryData<SessionInfo[]>(sessionKeys.list());
      queryClient.setQueryData<SessionInfo[]>(sessionKeys.list(), (old) =>
        old?.map((s) => (s.id === id ? { ...s, name } : s)) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(sessionKeys.list(), context.previous);
      }
      toast.error('세션 이름 변경에 실패했습니다');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
  });

  const renameSession = useCallback(
    async (id: string, name: string) => {
      await renameMutation.mutateAsync({ id, name });
    },
    [renameMutation],
  );

  const refreshSessions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: sessionKeys.list() });
  }, [queryClient]);

  const activeSessionId = extractSessionIdFromPath(location.pathname);

  return {
    sessions,
    activeSessionId,
    isLoading,
    isError,
    deleteSession,
    renameSession,
    selectSession,
    refreshSessions,
  };
}

function extractSessionIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/session\/([^/]+)/);
  if (!match || match[1] === 'new') return null;
  return match[1];
}
