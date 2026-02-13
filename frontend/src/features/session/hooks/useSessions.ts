import { useState, useEffect, useCallback } from 'react';
import { sessionsApi } from '@/lib/api/sessions.api';
import type { SessionInfo } from '@/types';

/**
 * 세션 관리 훅 - 세션 목록, 생성, 삭제, 선택 로직.
 */
export function useSessions() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    sessionsApi.list().then(setSessions).catch(() => {});
  }, []);

  const createSession = useCallback(async (workDir?: string) => {
    const session = await sessionsApi.create(workDir);
    setSessions((prev) => [...prev, session]);
    setActiveSessionId(session.id);
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      await sessionsApi.delete(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        setActiveSessionId(null);
      }
    },
    [activeSessionId],
  );

  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  return {
    sessions,
    activeSessionId,
    createSession,
    deleteSession,
    selectSession,
  };
}
