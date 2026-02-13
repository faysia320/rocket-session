import { useEffect, useRef, useState, useCallback } from 'react';
import { config } from '../../../config/env';

/**
 * WebSocket URL을 현재 페이지 기반으로 동적 생성.
 * Vite proxy를 통해 /ws 경로가 백엔드로 프록시됩니다.
 */
function getWsUrl(sessionId) {
  const wsBase =
    config.WS_BASE_URL ||
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
  return `${wsBase}/ws/${sessionId}`;
}

export function useClaudeSocket(sessionId) {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('idle');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [fileChanges, setFileChanges] = useState([]);

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
        const data = JSON.parse(evt.data);
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
  }, [sessionId]);

  const handleMessage = useCallback((data) => {
    switch (data.type) {
      case 'session_state':
        setSessionInfo(data.session);
        if (data.history)
          setMessages(
            data.history.map((h) => ({
              type: h.role === 'user' ? 'user_message' : 'result',
              message: h,
              text: h.content,
              timestamp: h.timestamp,
            })),
          );
        break;

      case 'session_info':
        setSessionInfo((prev) => ({
          ...prev,
          claude_session_id: data.claude_session_id,
        }));
        break;

      case 'status':
        setStatus(data.status);
        break;

      case 'user_message':
        setMessages((prev) => [...prev, data]);
        break;

      case 'assistant_text':
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.type === 'assistant_text') {
            return [...prev.slice(0, -1), data];
          }
          return [...prev, data];
        });
        break;

      case 'tool_use':
        setMessages((prev) => [...prev, data]);
        break;

      case 'file_change':
        setFileChanges((prev) => [...prev, data.change]);
        break;

      case 'result':
        setMessages((prev) => {
          const cleaned =
            prev[prev.length - 1]?.type === 'assistant_text'
              ? prev.slice(0, -1)
              : prev;
          return [...cleaned, data];
        });
        break;

      case 'error':
        setMessages((prev) => [...prev, data]);
        break;

      case 'stderr':
        setMessages((prev) => [
          ...prev,
          { type: 'stderr', text: data.text },
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
          { type: 'event', event: data.event },
        ]);
        break;

      default:
        break;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  const sendPrompt = useCallback((prompt, allowedTools) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'prompt',
          prompt,
          allowed_tools: allowedTools,
        }),
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
