import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type {
  Message,
  FileChange,
  SessionMode,
  PermissionRequestData,
  MessageUpdate,
  ToolUseMsg,
  AssistantTextMsg,
  ResultMsg,
  AskUserQuestionMsg,
  AskUserQuestionItem,
} from "@/types";
import { getMessageText } from "@/types";
import {
  getWsUrl,
  getBackoffDelay,
  generateMessageId,
  RECONNECT_MAX_ATTEMPTS,
} from "./useClaudeSocket.utils";

// 재연결 상태
export interface ReconnectState {
  status: "connected" | "reconnecting" | "failed";
  attempt: number;
  maxAttempts: number;
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
  model?: string;
}

// 히스토리 항목 타입
interface HistoryItem {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  cost?: number;
  duration_ms?: number;
  is_error?: boolean | number;
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
  model?: string;
}

export function useClaudeSocket(sessionId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnect = useRef(true);
  const lastModeRef = useRef<"normal" | "plan">("normal");
  const lastSeqRef = useRef<number>(0);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<"idle" | "running">("idle");
  const [sessionInfo, setSessionInfo] = useState<SessionState | null>(null);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [activeTools, setActiveTools] = useState<ToolUseMsg[]>([]);
  const [pendingPermission, setPendingPermission] =
    useState<PermissionRequestData | null>(null);
  const [loading, setLoading] = useState(true);
  // processedSeqs Set 제거: lastSeqRef 단조 증가 비교로 중복 방지 (메모리 누수 수정)
  const reconnectAttempt = useRef(0);
  const [reconnectState, setReconnectState] = useState<ReconnectState>({
    status: "reconnecting",
    attempt: 0,
    maxAttempts: RECONNECT_MAX_ATTEMPTS,
  });
  const [tokenUsage, setTokenUsage] = useState<{
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  }>({
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  });

  // sessionId 변경 시 모든 상태 초기화 (방어적 코드)
  useEffect(() => {
    setMessages([]);
    setFileChanges([]);
    setActiveTools([]);
    setStatus("idle");
    setSessionInfo(null);
    setLoading(true);
    setPendingPermission(null);
    lastSeqRef.current = 0;
    reconnectAttempt.current = 0;
    setReconnectState({
      status: "reconnecting",
      attempt: 0,
      maxAttempts: RECONNECT_MAX_ATTEMPTS,
    });
    setTokenUsage({
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    });
  }, [sessionId]);

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    // seq 기반 중복 방지: lastSeqRef 단조 증가 비교 (Set 대신 O(1) 메모리)
    if (typeof data.seq === "number") {
      if (data.seq <= lastSeqRef.current) return; // 중복 이벤트 스킵
      lastSeqRef.current = data.seq;
    }

    switch (data.type) {
      case "session_state":
        setSessionInfo(data.session as SessionState);
        setLoading(false);
        // latest_seq 업데이트 (서버에서 전달)
        if (
          typeof data.latest_seq === "number" &&
          data.latest_seq > lastSeqRef.current
        ) {
          lastSeqRef.current = data.latest_seq;
        }
        // running 상태 복원
        if (data.is_running) {
          setStatus("running");
        }
        // 재연결 시에는 히스토리를 덮어쓰지 않음
        if (!data.is_reconnect && data.history) {
          setMessages(
            (data.history as HistoryItem[]).map(
              (h, index) =>
                ({
                  id: `hist-${index}`,
                  type: h.role === "user" ? "user_message" : "result",
                  message: h as unknown as string,
                  text: h.content,
                  timestamp: h.timestamp,
                  cost: h.cost,
                  duration_ms: h.duration_ms,
                  is_error: Boolean(h.is_error),
                  input_tokens: h.input_tokens,
                  output_tokens: h.output_tokens,
                  cache_creation_tokens: h.cache_creation_tokens,
                  cache_read_tokens: h.cache_read_tokens,
                  model: h.model,
                }) as Message,
            ),
          );
          // 히스토리에서 토큰 합산 복원
          const historyItems = data.history as HistoryItem[];
          let totalIn = 0,
            totalOut = 0,
            totalCacheCreate = 0,
            totalCacheRead = 0;
          for (const h of historyItems) {
            totalIn += h.input_tokens || 0;
            totalOut += h.output_tokens || 0;
            totalCacheCreate += h.cache_creation_tokens || 0;
            totalCacheRead += h.cache_read_tokens || 0;
          }
          setTokenUsage({
            inputTokens: totalIn,
            outputTokens: totalOut,
            cacheCreationTokens: totalCacheCreate,
            cacheReadTokens: totalCacheRead,
          });
          // 현재 턴 이벤트가 있으면 순차 재생 (새로고침 후 running 세션 복구)
          if (data.current_turn_events) {
            const turnEvents = data.current_turn_events as Record<
              string,
              unknown
            >[];
            for (const event of turnEvents) {
              // user_message는 history에 이미 포함되므로 스킵
              if (event.type !== "user_message") {
                handleMessage(event);
              }
            }
          }
        }
        break;

      case "missed_events": {
        // 놓친 이벤트를 순서대로 재처리
        const events = data.events as Record<string, unknown>[];
        if (events) {
          for (const event of events) {
            handleMessage(event);
          }
        }
        break;
      }

      case "session_info":
        setSessionInfo((prev) => ({
          ...prev,
          claude_session_id: data.claude_session_id as string,
        }));
        break;

      case "status":
        setStatus(data.status as "idle" | "running");
        if (data.status === "idle") {
          setActiveTools([]);
          // running 상태로 남아있는 모든 tool_use를 정리 (강제 중지 등)
          setMessages((prev) =>
            prev.map((msg) =>
              msg.type === "tool_use" && msg.status === "running"
                ? ({ ...msg, status: "done" as const } as Message)
                : msg,
            ),
          );
        }
        break;

      case "user_message":
        setMessages((prev) => [
          ...prev,
          { ...(data as unknown as Message), id: generateMessageId() },
        ]);
        break;

      case "assistant_text":
        setMessages((prev) => {
          // 같은 연속 텍스트 블록 내의 마지막 assistant_text를 역순 탐색
          // tool_use/tool_result 경계 이후의 새 텍스트는 별도 메시지로 추가
          let lastIdx = -1;
          for (let i = prev.length - 1; i >= 0; i--) {
            const t = prev[i].type;
            if (
              t === "user_message" ||
              t === "result" ||
              t === "tool_use" ||
              t === "tool_result"
            )
              break;
            if (t === "assistant_text") {
              lastIdx = i;
              break;
            }
          }
          if (lastIdx >= 0) {
            // 기존 assistant_text를 덮어쓰기 (ID 유지로 virtualizer key 안정성)
            const updated = [...prev];
            updated[lastIdx] = {
              ...(data as unknown as AssistantTextMsg),
              id: prev[lastIdx].id,
            };
            return updated;
          }
          return [
            ...prev,
            { ...(data as unknown as Message), id: generateMessageId() },
          ];
        });
        break;

      case "tool_use":
        setMessages((prev) => [
          ...prev,
          {
            ...(data as unknown as ToolUseMsg),
            id: generateMessageId(),
            status: "running" as const,
          },
        ]);
        setActiveTools((prev) => [...prev, data as unknown as ToolUseMsg]);
        break;

      case "tool_result": {
        const toolUseId = data.tool_use_id as string;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.type === "tool_use" &&
            msg.tool_use_id === toolUseId &&
            msg.status === "running"
              ? ({
                  ...msg,
                  status: data.is_error ? "error" : "done",
                  output: data.output as string,
                  is_error: data.is_error as boolean,
                  is_truncated: data.is_truncated as boolean | undefined,
                  full_length: data.full_length as number | undefined,
                  completed_at: data.timestamp as string,
                } as Message)
              : msg,
          ),
        );
        setActiveTools((prev) =>
          prev.filter((t) => t.tool_use_id !== toolUseId),
        );
        break;
      }

      case "file_change":
        setFileChanges((prev) => [...prev, data.change as FileChange]);
        break;

      case "result": {
        setMessages((prev) => {
          const resultData = data as unknown as ResultMsg;
          // 현재 턴에서 마지막 assistant_text 찾기 (역순 탐색, user_message/result 경계까지)
          let lastAssistantIdx = -1;
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i].type === "user_message" || prev[i].type === "result")
              break;
            if (prev[i].type === "assistant_text") {
              lastAssistantIdx = i;
              break;
            }
          }
          const assistantText =
            lastAssistantIdx >= 0
              ? (prev[lastAssistantIdx] as AssistantTextMsg).text
              : undefined;
          const cleaned =
            lastAssistantIdx >= 0
              ? [
                  ...prev.slice(0, lastAssistantIdx),
                  ...prev.slice(lastAssistantIdx + 1),
                ]
              : prev;
          // result 텍스트가 없으면 이전 assistant_text 텍스트를 보존
          const text = resultData.text || assistantText;
          return [
            ...cleaned,
            {
              ...resultData,
              text,
              id: generateMessageId(),
              mode: (data.mode as "normal" | "plan") || lastModeRef.current,
            } as Message,
          ];
        });
        // 토큰 사용량 누적
        if (
          typeof data.input_tokens === "number" ||
          typeof data.output_tokens === "number"
        ) {
          setTokenUsage((prev) => ({
            inputTokens:
              prev.inputTokens + ((data.input_tokens as number) || 0),
            outputTokens:
              prev.outputTokens + ((data.output_tokens as number) || 0),
            cacheCreationTokens:
              prev.cacheCreationTokens +
              ((data.cache_creation_tokens as number) || 0),
            cacheReadTokens:
              prev.cacheReadTokens + ((data.cache_read_tokens as number) || 0),
          }));
        }
        break;
      }

      case "error":
        setMessages((prev) => [
          ...prev,
          { ...(data as unknown as Message), id: generateMessageId() },
        ]);
        if (data.message === "Session not found") {
          shouldReconnect.current = false;
        }
        break;

      case "stderr":
        setMessages((prev) => [
          ...prev,
          {
            id: generateMessageId(),
            type: "stderr",
            text: data.text as string,
          },
        ]);
        break;

      case "stopped":
        setStatus("idle");
        setActiveTools([]);
        setMessages((prev) => {
          // running 상태 tool_use를 모두 done으로 전환
          const cleaned = prev.map((msg) =>
            msg.type === "tool_use" && msg.status === "running"
              ? ({ ...msg, status: "done" as const } as Message)
              : msg,
          );
          return [
            ...cleaned,
            {
              id: generateMessageId(),
              type: "system" as const,
              text: "Session stopped by user.",
            },
          ];
        });
        break;

      case "thinking":
        setMessages((prev) => {
          // 현재 턴에서 마지막 thinking 메시지 역순 탐색 (tool_use/user_message/result 경계까지)
          let lastIdx = -1;
          for (let i = prev.length - 1; i >= 0; i--) {
            const t = prev[i].type;
            if (
              t === "user_message" ||
              t === "result" ||
              t === "tool_use" ||
              t === "tool_result"
            )
              break;
            if (t === "thinking") {
              lastIdx = i;
              break;
            }
          }
          if (lastIdx >= 0) {
            const updated = [...prev];
            updated[lastIdx] = {
              ...(data as unknown as Message),
              id: prev[lastIdx].id,
            };
            return updated;
          }
          return [
            ...prev,
            { ...(data as unknown as Message), id: generateMessageId() },
          ];
        });
        break;

      case "event":
        setMessages((prev) => [
          ...prev,
          {
            id: generateMessageId(),
            type: "event",
            event: data.event as Record<string, unknown>,
          },
        ]);
        break;

      case "ask_user_question": {
        const questions = (data.questions as AskUserQuestionItem[]) || [];
        const toolUseIdAsk = (data.tool_use_id as string) || "";
        setMessages((prev) => [
          ...prev,
          {
            id: generateMessageId(),
            type: "ask_user_question",
            questions,
            tool_use_id: toolUseIdAsk,
            answers: {},
            answered: false,
            sent: false,
            timestamp: (data.timestamp as string) || new Date().toISOString(),
          } as AskUserQuestionMsg,
        ]);
        break;
      }

      case "permission_request": {
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
            type: "permission_request",
            tool: permData.tool_name,
            input: permData.tool_input,
            timestamp: permData.timestamp,
          },
        ]);
        break;
      }

      case "permission_response":
        setPendingPermission(null);
        if (data.reason) {
          setMessages((prev) => [
            ...prev,
            {
              id: generateMessageId(),
              type: "system",
              text: `Permission: ${data.reason as string}`,
            },
          ]);
        }
        break;

      case "mode_change":
        setMessages((prev) => [
          ...prev,
          {
            id: generateMessageId(),
            type: "system",
            text: `Mode: ${data.from_mode as string} → ${data.to_mode as string}`,
          },
        ]);
        setSessionInfo((prev) =>
          prev ? { ...prev, mode: data.to_mode as "normal" | "plan" } : prev,
        );
        break;

      case "raw":
        setMessages((prev) => [
          ...prev,
          {
            id: generateMessageId(),
            type: "stderr",
            text: data.text as string,
          },
        ]);
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
      setReconnectState({
        status: "connected",
        attempt: 0,
        maxAttempts: RECONNECT_MAX_ATTEMPTS,
      });
      // 재연결 시 stale 도구 표시 방지
      if (seq) setActiveTools([]);
      console.log(
        "[WS]",
        seq ? `Reconnected (last_seq=${seq})` : "Connected",
        "to session",
        sessionId,
      );
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as Record<string, unknown>;
        handleMessage(data);
      } catch (e) {
        console.error("[WS] Parse error:", e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      console.log("[WS] Disconnected");
      if (shouldReconnect.current) {
        const attempt = reconnectAttempt.current;
        if (attempt >= RECONNECT_MAX_ATTEMPTS) {
          setReconnectState({
            status: "failed",
            attempt,
            maxAttempts: RECONNECT_MAX_ATTEMPTS,
          });
          console.warn("[WS] Max reconnect attempts reached");
          return;
        }
        reconnectAttempt.current = attempt + 1;
        const delay = getBackoffDelay(attempt);
        setReconnectState({
          status: "reconnecting",
          attempt: attempt + 1,
          maxAttempts: RECONNECT_MAX_ATTEMPTS,
        });
        console.log(
          `[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${attempt + 1}/${RECONNECT_MAX_ATTEMPTS})`,
        );
        reconnectTimer.current = setTimeout(() => connect(), delay);
      }
    };

    ws.onerror = (err) => {
      console.error("[WS] Error:", err);
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

  /** 특정 질문에 대한 답변 업데이트 */
  const answerQuestion = useCallback(
    (messageId: string, questionIndex: number, selectedLabels: string[]) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId || m.type !== "ask_user_question") return m;
          const msg = m as AskUserQuestionMsg;
          return {
            ...msg,
            answers: { ...msg.answers, [questionIndex]: selectedLabels },
          } as Message;
        }),
      );
    },
    [],
  );

  /** 질문 카드의 답변 확정 */
  const confirmAnswers = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || m.type !== "ask_user_question") return m;
        return { ...m, answered: true } as Message;
      }),
    );
  }, []);

  /** 미전송 답변 카운트 */
  const pendingAnswerCount = useMemo(() => {
    return messages.filter(
      (m) =>
        m.type === "ask_user_question" &&
        (m as AskUserQuestionMsg).answered &&
        !(m as AskUserQuestionMsg).sent,
    ).length;
  }, [messages]);

  const sendPrompt = useCallback(
    (
      prompt: string,
      options?: {
        allowedTools?: string[];
        mode?: SessionMode;
        images?: string[];
      },
    ) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // 미전송 답변을 prompt에 prefix로 추가
        let finalPrompt = prompt;
        const answerCtx = messages
          .filter(
            (m) =>
              m.type === "ask_user_question" &&
              (m as AskUserQuestionMsg).answered &&
              !(m as AskUserQuestionMsg).sent,
          )
          .map((m) => {
            const msg = m as AskUserQuestionMsg;
            const lines: string[] = [];
            for (const [idxStr, labels] of Object.entries(msg.answers || {})) {
              const idx = Number(idxStr);
              const q = msg.questions[idx];
              if (!q || labels.length === 0) continue;
              lines.push(`[${q.header || q.question}]: ${labels.join(", ")}`);
            }
            return lines.join("\n");
          })
          .filter(Boolean)
          .join("\n");

        if (answerCtx) {
          finalPrompt = `[이전 질문에 대한 답변]\n${answerCtx}\n\n${prompt}`;
          // 전송된 답변을 sent로 마킹
          setMessages((prev) =>
            prev.map((m) => {
              if (
                m.type === "ask_user_question" &&
                (m as AskUserQuestionMsg).answered &&
                !(m as AskUserQuestionMsg).sent
              ) {
                return { ...m, sent: true } as Message;
              }
              return m;
            }),
          );
        }

        lastModeRef.current = options?.mode || "normal";
        wsRef.current.send(
          JSON.stringify({
            type: "prompt",
            prompt: finalPrompt,
            allowed_tools: options?.allowedTools,
            mode: options?.mode,
            images: options?.images,
          }),
        );
      }
    },
    [messages],
  );

  const stopExecution = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setFileChanges([]);
    lastSeqRef.current = 0;
  }, []);

  const addSystemMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: generateMessageId(), type: "system" as const, text },
    ]);
  }, []);

  const updateMessage = useCallback((id: string, patch: MessageUpdate) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? ({ ...m, ...patch } as Message) : m)),
    );
  }, []);

  const reconnect = useCallback(() => {
    reconnectAttempt.current = 0;
    setReconnectState({
      status: "reconnecting",
      attempt: 0,
      maxAttempts: RECONNECT_MAX_ATTEMPTS,
    });
    connect();
  }, [connect]);

  const updateSessionMode = useCallback((newMode: SessionMode) => {
    setSessionInfo((prev) =>
      prev ? { ...prev, mode: newMode } : prev,
    );
  }, []);

  const respondPermission = useCallback(
    (permissionId: string, behavior: "allow" | "deny") => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "permission_respond",
            permission_id: permissionId,
            behavior,
          }),
        );
      }
      setPendingPermission(null);
    },
    [],
  );

  // 대규모 대화(300+ 메시지) 시 오래된 메시지 텍스트 압축 (idle 시에만)
  const MAX_FULL_MESSAGES = 300;
  useEffect(() => {
    if (status !== "idle" || messages.length <= MAX_FULL_MESSAGES) return;
    setMessages((prev) => {
      const cutoff = prev.length - MAX_FULL_MESSAGES;
      let changed = false;
      const updated = prev.map((m, i) => {
        const mText = getMessageText(m);
        if (i < cutoff && mText.length > 500 && !(m as any)._truncated) {
          changed = true;
          return {
            ...m,
            text:
              mText.slice(0, 200) +
              "\n\n\u2026 (이전 메시지, 전체 내용은 내보내기를 사용하세요)",
            _truncated: true,
          } as any as Message;
        }
        return m;
      });
      return changed ? updated : prev;
    });
  }, [status, messages.length]);

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
    tokenUsage,
    pendingAnswerCount,
    sendPrompt,
    stopExecution,
    clearMessages,
    addSystemMessage,
    updateMessage,
    respondPermission,
    reconnect,
    answerQuestion,
    confirmAnswers,
    updateSessionMode,
  };
}
