import { useEffect, useRef, useState, useCallback } from 'react';
import { config } from '@/config/env';
import type { Message, FileChange } from '@/types';

/**
 * WebSocket URL을 현재 페이지 기반으로 동적 생성.
 * Vite proxy를 통해 /ws 경로가 백엔드로 프록시됩니다.
 */
function getWsUrl(sessionId: string): string {
  const wsBase =
    config.WS_BASE_URL ||
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
  return `${wsBase}/ws/${sessionId}`;
}

// 세션 상태 인터페이스 (부분 타입)
interface SessionState {
  claude_session_id?: string;
  [key: string]: unknown;
}

// 히스토리 항목 타입
interface HistoryItem {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export function useClaudeSocket(sessionId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<'idle' | 'running'>('idle');
  const [sessionInfo, setSessionInfo] = useState<SessionState | null>(null);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    switch (data.type) {
      case 'session_state':
        setSessionInfo(data.session as SessionState);
        if (data.history) {
          setMessages(
            (data.history as HistoryItem[]).map((h) => ({
              type: h.role === 'user' ? 'user_message' : 'result',
              message: h as unknown as string,
              text: h.content,
              timestamp: h.timestamp,
            }))
          );
        }
        break;

      case 'session_info':
        setSessionInfo((prev) => ({
          ...prev,
          claude_session_id: data.claude_session_id as string,
        }));
        break;

      case 'status':
        setStatus(data.status as 'idle' | 'running');
        break;

      case 'user_message':
        setMessages((prev) => [...prev, data as unknown as Message]);
        break;

      case 'assistant_text':
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.type === 'assistant_text') {
            return [...prev.slice(0, -1), data as unknown as Message];
          }
          return [...prev, data as unknown as Message];
        });
        break;

      case 'tool_use':
        setMessages((prev) => [...prev, data as unknown as Message]);
        break;

      case 'file_change':
        setFileChanges((prev) => [...prev, data.change as FileChange]);
        break;

      case 'result':
        setMessages((prev) => {
          const cleaned =
            prev[prev.length - 1]?.type === 'assistant_text'
              ? prev.slice(0, -1)
              : prev;
          return [...cleaned, data as unknown as Message];
        });
        break;

      case 'error':
        setMessages((prev) => [...prev, data as unknown as Message]);
        break;

      case 'stderr':
        setMessages((prev) => [
          ...prev,
          { type: 'stderr', text: data.text as string },
        ]);
        break;

      case 'stopped':
        setStatus('idle');
        setMessages((prev) => [
          ...prev,
          { type: 'system', text: 'Session stopped by user.' },
        ]);
        break;

      case 'event':
        setMessages((prev) => [
          ...prev,
          { type: 'event', event: data.event as Record<string, unknown> },
        ]);
        break;

      default:
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (!sessionId) return;

    const ws = new WebSocket(getWsUrl(sessionId));
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log('[WS] Connected to session', sessionId);
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as Record<string, unknown>;
        handleMessage(data);
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log('[WS] Disconnected');
      reconnectTimer.current = setTimeout(() => connect(), 3000);
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };
  }, [sessionId, handleMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  const sendPrompt = useCallback((prompt: string, allowedTools?: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'prompt',
          prompt,
          allowed_tools: allowedTools,
        })
      );
    }
  }, []);

  const stopExecution = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }
  }, []);

  return {
    connected,
    messages,
    status,
    sessionInfo,
    fileChanges,
    sendPrompt,
    stopExecution,
  };
}
