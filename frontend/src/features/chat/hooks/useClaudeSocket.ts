import { useEffect, useRef, useState, useCallback } from 'react';
import { config } from '@/config/env';
import type { Message, FileChange, SessionMode, PermissionRequestData } from '@/types';

/**
 * WebSocket URL을 현재 페이지 기반으로 동적 생성.
 * Vite proxy를 통해 /ws 경로가 백엔드로 프록시됩니다.
 */
function getWsUrl(sessionId: string, lastSeq?: number): string {
  const wsBase =
    config.WS_BASE_URL ||
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
  const base = `${wsBase}/ws/${sessionId}`;
  return lastSeq ? `${base}?last_seq=${lastSeq}` : base;
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

// 메시지 고유 ID 생성기
let _msgIdCounter = 0;
function generateMessageId(): string {
  return `msg-${Date.now()}-${++_msgIdCounter}`;
}

export function useClaudeSocket(sessionId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnect = useRef(true);
  const lastModeRef = useRef<'normal' | 'plan'>('normal');
  const lastSeqRef = useRef<number>(0);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<'idle' | 'running'>('idle');
  const [sessionInfo, setSessionInfo] = useState<SessionState | null>(null);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [activeTools, setActiveTools] = useState<Message[]>([]);
  const [pendingPermission, setPendingPermission] = useState<PermissionRequestData | null>(null);

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    // 모든 이벤트에서 seq 추적
    if (typeof data.seq === 'number' && data.seq > lastSeqRef.current) {
      lastSeqRef.current = data.seq;
    }

    switch (data.type) {
      case 'session_state':
        setSessionInfo(data.session as SessionState);
        // latest_seq 업데이트 (서버에서 전달)
        if (typeof data.latest_seq === 'number' && data.latest_seq > lastSeqRef.current) {
          lastSeqRef.current = data.latest_seq;
        }
        // 재연결 시에는 히스토리를 덮어쓰지 않음
        if (!data.is_reconnect && data.history) {
          setMessages(
            (data.history as HistoryItem[]).map((h, index) => ({
              id: `hist-${index}`,
              type: h.role === 'user' ? 'user_message' : 'result',
              message: h as unknown as string,
              text: h.content,
              timestamp: h.timestamp,
            }))
          );
        }
        break;

      case 'missed_events': {
        // 놓친 이벤트를 순서대로 재처리
        const events = data.events as Record<string, unknown>[];
        if (events) {
          for (const event of events) {
            handleMessage(event);
          }
        }
        break;
      }

      case 'session_info':
        setSessionInfo((prev) => ({
          ...prev,
          claude_session_id: data.claude_session_id as string,
        }));
        break;

      case 'status':
        setStatus(data.status as 'idle' | 'running');
        if (data.status === 'idle') setActiveTools([]);
        break;

      case 'user_message':
        setMessages((prev) => [...prev, { ...(data as unknown as Message), id: generateMessageId() }]);
        break;

      case 'assistant_text':
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.type === 'assistant_text') {
            // 스트리밍 중 기존 ID 유지 (virtualizer key 안정성)
            return [...prev.slice(0, -1), { ...(data as unknown as Message), id: last.id }];
          }
          return [...prev, { ...(data as unknown as Message), id: generateMessageId() }];
        });
        break;

      case 'tool_use':
        setMessages((prev) => [...prev, { ...(data as unknown as Message), id: generateMessageId(), status: 'running' }]);
        setActiveTools((prev) => [...prev, data as unknown as Message]);
        break;

      case 'tool_result': {
        const toolUseId = data.tool_use_id as string;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.type === 'tool_use' && msg.tool_use_id === toolUseId && msg.status === 'running'
              ? { ...msg, status: data.is_error ? 'error' : 'done', output: data.output as string, is_error: data.is_error as boolean }
              : msg
          )
        );
        setActiveTools((prev) => prev.filter((t) => t.tool_use_id !== toolUseId));
        break;
      }

      case 'file_change':
        setFileChanges((prev) => [...prev, data.change as FileChange]);
        break;

      case 'result':
        setMessages((prev) => {
          const cleaned =
            prev[prev.length - 1]?.type === 'assistant_text'
              ? prev.slice(0, -1)
              : prev;
          return [...cleaned, {
            ...(data as unknown as Message),
            id: generateMessageId(),
            mode: (data.mode as 'normal' | 'plan') || lastModeRef.current,
          }];
        });
        break;

      case 'error':
        setMessages((prev) => [...prev, { ...(data as unknown as Message), id: generateMessageId() }]);
        if (data.message === 'Session not found') {
          shouldReconnect.current = false;
        }
        break;

      case 'stderr':
        setMessages((prev) => [
          ...prev,
          { id: generateMessageId(), type: 'stderr', text: data.text as string },
        ]);
        break;

      case 'stopped':
        setStatus('idle');
        setMessages((prev) => [
          ...prev,
          { id: generateMessageId(), type: 'system', text: 'Session stopped by user.' },
        ]);
        break;

      case 'event':
        setMessages((prev) => [
          ...prev,
          { id: generateMessageId(), type: 'event', event: data.event as Record<string, unknown> },
        ]);
        break;

      case 'permission_request': {
        const permData: PermissionRequestData = {
          permission_id: data.permission_id as string,
          tool_name: data.tool_name as string,
          tool_input: (data.tool_input as Record<string, unknown>) || {},
          timestamp: new Date().toISOString(),
        };
        setPendingPermission(permData);
        setMessages((prev) => [
          ...prev,
          {
            id: generateMessageId(),
            type: 'permission_request',
            tool: permData.tool_name,
            input: permData.tool_input,
            timestamp: permData.timestamp,
          },
        ]);
        break;
      }

      case 'permission_response':
        setPendingPermission(null);
        break;

      default:
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (!sessionId) return;

    // 기존 연결이 있으면 먼저 정리 (StrictMode 이중 마운트 대응)
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    shouldReconnect.current = true;
    // 재연결 시 last_seq 파라미터로 놓친 이벤트 요청
    const seq = lastSeqRef.current > 0 ? lastSeqRef.current : undefined;
    const ws = new WebSocket(getWsUrl(sessionId, seq));
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log('[WS]', seq ? `Reconnected (last_seq=${seq})` : 'Connected', 'to session', sessionId);
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
      if (shouldReconnect.current) {
        reconnectTimer.current = setTimeout(() => connect(), 3000);
      }
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };
  }, [sessionId, handleMessage]);

  useEffect(() => {
    connect();
    return () => {
      shouldReconnect.current = false;
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };
  }, [connect]);

  const sendPrompt = useCallback(
    (prompt: string, options?: { allowedTools?: string[]; mode?: SessionMode }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        lastModeRef.current = options?.mode || 'normal';
        wsRef.current.send(
          JSON.stringify({
            type: 'prompt',
            prompt,
            allowed_tools: options?.allowedTools,
            mode: options?.mode,
          })
        );
      }
    },
    []
  );

  const stopExecution = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setFileChanges([]);
    lastSeqRef.current = 0;
  }, []);

  const addSystemMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: generateMessageId(), type: 'system', text }]);
  }, []);

  const updateMessage = useCallback((id: string, patch: Partial<Message>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const respondPermission = useCallback(
    (permissionId: string, behavior: 'allow' | 'deny') => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'permission_respond',
            permission_id: permissionId,
            behavior,
          })
        );
      }
      setPendingPermission(null);
    },
    []
  );

  return {
    connected,
    messages,
    status,
    sessionInfo,
    fileChanges,
    activeTools,
    pendingPermission,
    sendPrompt,
    stopExecution,
    clearMessages,
    addSystemMessage,
    updateMessage,
    respondPermission,
  };
}
