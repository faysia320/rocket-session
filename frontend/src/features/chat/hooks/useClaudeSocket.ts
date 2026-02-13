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

// 재연결 상태
export interface ReconnectState {
  status: 'connected' | 'reconnecting' | 'failed';
  attempt: number;
  maxAttempts: number;
}

// 재연결 설정
const RECONNECT_MAX_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;

function getBackoffDelay(attempt: number): number {
  const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, attempt), RECONNECT_MAX_DELAY);
  return delay * (0.8 + Math.random() * 0.4);
}

// 세션 상태 인터페이스
interface SessionState {
  claude_session_id?: string;
  work_dir?: string;
  mode?: SessionMode;
  name?: string;
  status?: string;
  allowed_tools?: string;
  system_prompt?: string;
  timeout_seconds?: number;
  permission_mode?: number;
  permission_required_tools?: string;
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
  const [loading, setLoading] = useState(true);
  const reconnectAttempt = useRef(0);
  const [reconnectState, setReconnectState] = useState<ReconnectState>({
    status: 'reconnecting',
    attempt: 0,
    maxAttempts: RECONNECT_MAX_ATTEMPTS,
  });

  // sessionId 변경 시 모든 상태 초기화 (방어적 코드)
  useEffect(() => {
    setMessages([]);
    setFileChanges([]);
    setActiveTools([]);
    setStatus('idle');
    setSessionInfo(null);
    setLoading(true);
    setPendingPermission(null);
    lastSeqRef.current = 0;
    reconnectAttempt.current = 0;
    setReconnectState({
      status: 'reconnecting',
      attempt: 0,
      maxAttempts: RECONNECT_MAX_ATTEMPTS,
    });
  }, [sessionId]);

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    // 모든 이벤트에서 seq 추적
    if (typeof data.seq === 'number' && data.seq > lastSeqRef.current) {
      lastSeqRef.current = data.seq;
    }

    switch (data.type) {
      case 'session_state':
        setSessionInfo(data.session as SessionState);
        setLoading(false);
        // latest_seq 업데이트 (서버에서 전달)
        if (typeof data.latest_seq === 'number' && data.latest_seq > lastSeqRef.current) {
          lastSeqRef.current = data.latest_seq;
        }
        // running 상태 복원
        if (data.is_running) {
          setStatus('running');
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
          // 현재 턴 이벤트가 있으면 순차 재생 (새로고침 후 running 세션 복구)
          if (data.current_turn_events) {
            const turnEvents = data.current_turn_events as Record<string, unknown>[];
            for (const event of turnEvents) {
              // user_message는 history에 이미 포함되므로 스킵
              if (event.type !== 'user_message') {
                handleMessage(event);
              }
            }
          }
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
          // 같은 턴 내의 마지막 assistant_text를 역순 탐색
          // (user_message나 result 경계 이전까지만 검색)
          let lastIdx = -1;
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i].type === 'user_message' || prev[i].type === 'result') break;
            if (prev[i].type === 'assistant_text') { lastIdx = i; break; }
          }
          if (lastIdx >= 0) {
            // 기존 assistant_text를 덮어쓰기 (ID 유지로 virtualizer key 안정성)
            const updated = [...prev];
            updated[lastIdx] = { ...(data as unknown as Message), id: prev[lastIdx].id };
            return updated;
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
              ? {
                  ...msg,
                  status: data.is_error ? 'error' : 'done',
                  output: data.output as string,
                  is_error: data.is_error as boolean,
                  is_truncated: data.is_truncated as boolean | undefined,
                  full_length: data.full_length as number | undefined,
                }
              : msg
          )
        );
        setActiveTools((prev) => prev.filter((t) => t.tool_use_id !== toolUseId));
        break;
      }

      case 'file_change':
        setFileChanges((prev) => [...prev, data.change as FileChange]);
        break;

      case 'result': {
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          const isLastAssistant = lastMsg?.type === 'assistant_text';
          const cleaned = isLastAssistant ? prev.slice(0, -1) : prev;
          const resultData = data as unknown as Message;
          // result 텍스트가 없으면 이전 assistant_text 텍스트를 보존
          const text = resultData.text || (isLastAssistant ? lastMsg.text : undefined);
          return [...cleaned, {
            ...resultData,
            text,
            id: generateMessageId(),
            mode: (data.mode as 'normal' | 'plan') || lastModeRef.current,
          }];
        });
        break;
      }

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
    setLoading(true);

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
      reconnectAttempt.current = 0;
      setReconnectState({ status: 'connected', attempt: 0, maxAttempts: RECONNECT_MAX_ATTEMPTS });
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
        const attempt = reconnectAttempt.current;
        if (attempt >= RECONNECT_MAX_ATTEMPTS) {
          setReconnectState({ status: 'failed', attempt, maxAttempts: RECONNECT_MAX_ATTEMPTS });
          console.warn('[WS] Max reconnect attempts reached');
          return;
        }
        reconnectAttempt.current = attempt + 1;
        const delay = getBackoffDelay(attempt);
        setReconnectState({ status: 'reconnecting', attempt: attempt + 1, maxAttempts: RECONNECT_MAX_ATTEMPTS });
        console.log(`[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${attempt + 1}/${RECONNECT_MAX_ATTEMPTS})`);
        reconnectTimer.current = setTimeout(() => connect(), delay);
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
    (prompt: string, options?: { allowedTools?: string[]; mode?: SessionMode; images?: string[] }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        lastModeRef.current = options?.mode || 'normal';
        wsRef.current.send(
          JSON.stringify({
            type: 'prompt',
            prompt,
            allowed_tools: options?.allowedTools,
            mode: options?.mode,
            images: options?.images,
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

  const reconnect = useCallback(() => {
    reconnectAttempt.current = 0;
    setReconnectState({ status: 'reconnecting', attempt: 0, maxAttempts: RECONNECT_MAX_ATTEMPTS });
    connect();
  }, [connect]);

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
    loading,
    messages,
    status,
    sessionInfo,
    fileChanges,
    activeTools,
    pendingPermission,
    reconnectState,
    sendPrompt,
    stopExecution,
    clearMessages,
    addSystemMessage,
    updateMessage,
    respondPermission,
    reconnect,
  };
}
