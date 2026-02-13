import { useState, useEffect, useCallback } from 'react';
import { sessionsApi } from '../../../lib/api/sessions.api';

/**
 * 세션 관리 훅 - 세션 목록, 생성, 삭제, 선택 로직.
 */
export function useSessions() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);

  useEffect(() => {
    sessionsApi.list().then(setSessions).catch(() => {});
  }, []);

  const createSession = useCallback(async (workDir) => {
    const session = await sessionsApi.create(workDir);
    setSessions((prev) => [...prev, session]);
    setActiveSessionId(session.id);
  }, []);

  const deleteSession = useCallback(
    async (id) => {
      await sessionsApi.delete(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        setActiveSessionId(null);
      }
    },
    [activeSessionId],
  );

  const selectSession = useCallback((id) => {
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
