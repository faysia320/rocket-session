import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { sessionsApi } from '@/lib/api/sessions.api';
import type { SessionInfo } from '@/types';

/**
 * 세션 생성 전용 훅.
 * 라우트 컴포넌트에서 독립적으로 사용 가능.
 */
export function useCreateSession() {
  const navigate = useNavigate();

  const createSession = useCallback(async (
    workDir?: string,
    options?: { allowed_tools?: string; system_prompt?: string; timeout_seconds?: number },
  ) => {
    const session = await sessionsApi.create(workDir, options);
    navigate({ to: '/session/$sessionId', params: { sessionId: session.id } });
    return session;
  }, [navigate]);

  return { createSession };
}

/**
 * 세션 관리 훅 - 세션 목록, 생성, 삭제, 선택 로직.
 */
export function useSessions() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const fetchSessions = useCallback(() => {
    sessionsApi.list().then(setSessions).catch(() => {});
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // pathname 변경 시 세션 목록 갱신 (세션 생성/삭제 후 사이드바 반영)
  useEffect(() => {
    fetchSessions();
  }, [location.pathname, fetchSessions]);

  const createSession = useCallback(async (
    workDir?: string,
    options?: { allowed_tools?: string; system_prompt?: string; timeout_seconds?: number },
  ) => {
    const session = await sessionsApi.create(workDir, options);
    setSessions((prev) => [...prev, session]);
    setActiveSessionId(session.id);
    navigate({ to: '/session/$sessionId', params: { sessionId: session.id } });
  }, [navigate]);

  const deleteSession = useCallback(
    async (id: string) => {
      await sessionsApi.delete(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        setActiveSessionId(null);
        navigate({ to: '/' });
      }
    },
    [activeSessionId, navigate],
  );

  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    navigate({ to: '/session/$sessionId', params: { sessionId: id } });
  }, [navigate]);

  const refreshSessions = useCallback(async () => {
    const list = await sessionsApi.list();
    setSessions(list);
  }, []);

  return {
    sessions,
    activeSessionId,
    createSession,
    deleteSession,
    selectSession,
    refreshSessions,
  };
}
