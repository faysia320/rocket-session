import { useCallback } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionsApi } from '@/lib/api/sessions.api';
import { sessionKeys } from './sessionKeys';

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

  const { data: sessions = [] } = useQuery({
    queryKey: sessionKeys.list(),
    queryFn: () => sessionsApi.list(),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: () => {
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

  const refreshSessions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: sessionKeys.list() });
  }, [queryClient]);

  const activeSessionId = extractSessionIdFromPath(location.pathname);

  return {
    sessions,
    activeSessionId,
    deleteSession,
    selectSession,
    refreshSessions,
  };
}

function extractSessionIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/session\/([^/]+)/);
  if (!match || match[1] === 'new') return null;
  return match[1];
}
