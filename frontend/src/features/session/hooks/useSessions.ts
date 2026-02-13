import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { sessionsApi } from '@/lib/api/sessions.api';
import type { SessionInfo } from '@/types';

/**
 * 세션 관리 훅 - 세션 목록, 생성, 삭제, 선택 로직.
 */
export function useSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    sessionsApi.list().then(setSessions).catch(() => {});
  }, []);

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

  return {
    sessions,
    activeSessionId,
    createSession,
    deleteSession,
    selectSession,
  };
}
