import { useEffect, useRef, useReducer, useCallback, useMemo } from "react";
import type {
  Message,
  FileChange,
  SessionMode,
  PermissionRequestData,
  AssistantTextMsg,
  ToolUseMsg,
  AskUserQuestionMsg,
  AskUserQuestionItem,
  MessageUpdate,
} from "@/types";
import {
  getWsUrl,
  getBackoffDelay,
  RECONNECT_MAX_ATTEMPTS,
} from "./useClaudeSocket.utils";
import {
  claudeSocketReducer,
  initialState,
  type SessionState,
  type ClaudeSocketAction,
  type HistoryItem,
} from "./claudeSocketReducer";

export type { ReconnectState } from "./claudeSocketReducer";

export function useClaudeSocket(sessionId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnect = useRef(true);
  const lastModeRef = useRef<"normal" | "plan">("normal");
  const lastSeqRef = useRef<number>(0);
  // RAF 배치: assistant_text 스트리밍 최적화 (프레임당 1회 dispatch)
  const pendingTextRef = useRef<AssistantTextMsg | null>(null);
  const rafIdRef = useRef<number | null>(null);
  // sendPrompt에서 messages에 직접 의존하지 않도록 ref로 동기화
  const messagesRef = useRef<Message[]>([]);
  const reconnectAttempt = useRef(0);

  const [state, dispatch] = useReducer(claudeSocketReducer, initialState);

  // sessionId 변경 시 모든 상태 초기화
  useEffect(() => {
    dispatch({ type: "RESET_SESSION" });
    lastSeqRef.current = 0;
    reconnectAttempt.current = 0;
  }, [sessionId]);

  // messagesRef를 messages와 동기화 (sendPrompt에서 안정적으로 참조)
  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    // seq 기반 중복 방지: lastSeqRef 단조 증가 비교 (Set 대신 O(1) 메모리)
    if (typeof data.seq === "number") {
      if (data.seq <= lastSeqRef.current) return;
      lastSeqRef.current = data.seq;
    }

    switch (data.type) {
      case "session_state": {
        const action: ClaudeSocketAction = {
          type: "WS_SESSION_STATE",
          session: data.session as SessionState,
          isRunning: Boolean(data.is_running),
          isReconnect: Boolean(data.is_reconnect),
          history: (!data.is_reconnect && data.history)
            ? data.history as HistoryItem[]
            : null,
          latestSeq: typeof data.latest_seq === "number" ? data.latest_seq : undefined,
          currentTurnEvents: null, // current_turn_events는 아래에서 별도 처리
        };
        dispatch(action);

        // 현재 턴 이벤트가 있으면 순차 재생 (세션 전환/새로고침 후 복구)
        // latest_seq 업데이트 전에 수행하여 seq 중복 체크에 걸리지 않도록 함
        if (!data.is_reconnect && data.history && data.current_turn_events) {
          const turnEvents = data.current_turn_events as Record<string, unknown>[];
          for (const event of turnEvents) {
            // user_message: history에 이미 포함
            // result: history의 마지막 assistant 메시지와 중복
            if (event.type !== "user_message" && event.type !== "result") {
              handleMessage(event);
            }
          }
        }

        // latest_seq 업데이트는 모든 이벤트 재생 후 (seq 중복 방지 메커니즘 회피)
        if (
          typeof data.latest_seq === "number" &&
          data.latest_seq > lastSeqRef.current
        ) {
          lastSeqRef.current = data.latest_seq;
        }
        break;
      }

      case "missed_events": {
        const events = data.events as Record<string, unknown>[];
        if (events) {
          for (const event of events) {
            handleMessage(event);
          }
        }
        break;
      }

      case "session_info":
        dispatch({ type: "WS_SESSION_INFO", claudeSessionId: data.claude_session_id as string });
        break;

      case "status":
        dispatch({ type: "WS_STATUS", status: data.status as "idle" | "running" | "error" });
        break;

      case "user_message":
        dispatch({ type: "WS_USER_MESSAGE", data });
        break;

      case "assistant_text":
        // RAF 배치: 텍스트를 ref에 축적, 프레임당 1회만 dispatch 호출
        pendingTextRef.current = data as unknown as AssistantTextMsg;
        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            const latestText = pendingTextRef.current;
            if (!latestText) return;
            pendingTextRef.current = null;
            dispatch({ type: "WS_ASSISTANT_TEXT", data: latestText });
          });
        }
        break;

      case "tool_use":
        dispatch({ type: "WS_TOOL_USE", data: data as unknown as ToolUseMsg });
        break;

      case "tool_result":
        dispatch({
          type: "WS_TOOL_RESULT",
          toolUseId: data.tool_use_id as string,
          output: data.output as string,
          isError: data.is_error as boolean,
          isTruncated: data.is_truncated as boolean | undefined,
          fullLength: data.full_length as number | undefined,
          timestamp: data.timestamp as string,
        });
        break;

      case "file_change":
        dispatch({ type: "WS_FILE_CHANGE", change: data.change as FileChange });
        break;

      case "result": {
        const resultData = data as unknown as import("@/types").ResultMsg;
        dispatch({
          type: "WS_RESULT",
          data: resultData,
          mode: (data.mode as "normal" | "plan") || lastModeRef.current,
          inputTokens: (data.input_tokens as number) || 0,
          outputTokens: (data.output_tokens as number) || 0,
          cacheCreationTokens: (data.cache_creation_tokens as number) || 0,
          cacheReadTokens: (data.cache_read_tokens as number) || 0,
        });
        break;
      }

      case "error":
        dispatch({
          type: "WS_ERROR",
          data,
          isSessionNotFound: data.message === "세션을 찾을 수 없습니다",
        });
        if (data.message === "세션을 찾을 수 없습니다") {
          shouldReconnect.current = false;
        }
        break;

      case "stderr":
        dispatch({ type: "WS_STDERR", text: data.text as string });
        break;

      case "stopped":
        dispatch({ type: "WS_STOPPED" });
        break;

      case "thinking":
        dispatch({ type: "WS_THINKING", data });
        break;

      case "event":
        dispatch({ type: "WS_EVENT", event: data.event as Record<string, unknown> });
        break;

      case "ask_user_question": {
        const questions = (data.questions as AskUserQuestionItem[]) || [];
        const toolUseIdAsk = (data.tool_use_id as string) || "";
        dispatch({
          type: "WS_ASK_USER_QUESTION",
          questions,
          toolUseId: toolUseIdAsk,
          timestamp: (data.timestamp as string) || new Date().toISOString(),
        });
        break;
      }

      case "permission_request": {
        const permData: PermissionRequestData = {
          permission_id: data.permission_id as string,
          tool_name: data.tool_name as string,
          tool_input: (data.tool_input as Record<string, unknown>) || {},
          timestamp: new Date().toISOString(),
        };
        dispatch({ type: "WS_PERMISSION_REQUEST", permData });
        break;
      }

      case "permission_response":
        dispatch({ type: "WS_PERMISSION_RESPONSE", reason: data.reason as string | undefined });
        break;

      case "mode_change":
        dispatch({
          type: "WS_MODE_CHANGE",
          fromMode: data.from_mode as string,
          toMode: data.to_mode as SessionMode,
        });
        break;

      case "raw":
        dispatch({ type: "WS_RAW", text: data.text as string });
        break;

      default:
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (!sessionId) return;
    dispatch({ type: "SET_LOADING", loading: true });

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
    const seq = lastSeqRef.current > 0 ? lastSeqRef.current : undefined;
    const ws = new WebSocket(getWsUrl(sessionId, seq));
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempt.current = 0;
      dispatch({ type: "WS_OPEN", hadPriorSeq: Boolean(seq) });
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
      dispatch({ type: "SET_CONNECTED", connected: false });
      console.log("[WS] Disconnected");
      if (shouldReconnect.current) {
        const attempt = reconnectAttempt.current;
        if (attempt >= RECONNECT_MAX_ATTEMPTS) {
          dispatch({ type: "RECONNECT_FAILED", attempt });
          console.warn("[WS] Max reconnect attempts reached");
          return;
        }
        reconnectAttempt.current = attempt + 1;
        const delay = getBackoffDelay(attempt);
        dispatch({ type: "RECONNECT_SCHEDULE", attempt: attempt + 1 });
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
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [connect]);

  /** 특정 질문에 대한 답변 업데이트 */
  const answerQuestion = useCallback(
    (messageId: string, questionIndex: number, selectedLabels: string[]) => {
      dispatch({ type: "ANSWER_QUESTION", messageId, questionIndex, selectedLabels });
    },
    [],
  );

  /** 질문 카드의 답변 확정 */
  const confirmAnswers = useCallback((messageId: string) => {
    dispatch({ type: "CONFIRM_ANSWERS", messageId });
  }, []);

  /** 미전송 답변 카운트 */
  const pendingAnswerCount = useMemo(() => {
    return state.messages.filter(
      (m) =>
        m.type === "ask_user_question" &&
        (m as AskUserQuestionMsg).answered &&
        !(m as AskUserQuestionMsg).sent,
    ).length;
  }, [state.messages]);

  const sendPrompt = useCallback(
    (
      prompt: string,
      options?: {
        allowedTools?: string[];
        mode?: SessionMode;
        images?: string[];
        skipAnswerPrepend?: boolean;
      },
    ) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        let finalPrompt = prompt;

        // skipAnswerPrepend가 아닌 경우에만 미전송 답변을 prefix로 추가
        if (!options?.skipAnswerPrepend) {
          const answerCtx = messagesRef.current
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
            dispatch({ type: "MARK_ANSWERS_SENT" });
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- messagesRef로 안정적 참조, 함수 재생성 방지
    [],
  );

  /** 답변 확정 + 즉시 전송 (confirm 버튼 클릭 시 자동으로 프롬프트 전송) */
  const confirmAndSendAnswers = useCallback(
    (messageId: string) => {
      dispatch({ type: "CONFIRM_ANSWERS", messageId });
      dispatch({ type: "MARK_ANSWERS_SENT" });

      // messagesRef에서 답변 텍스트 구성 (answers는 이미 ANSWER_QUESTION으로 반영됨)
      const msg = messagesRef.current.find((m) => m.id === messageId);
      if (!msg || msg.type !== "ask_user_question") return;

      const askMsg = msg as AskUserQuestionMsg;
      const lines: string[] = [];
      for (const [idxStr, labels] of Object.entries(askMsg.answers || {})) {
        const idx = Number(idxStr);
        const q = askMsg.questions[idx];
        if (!q || labels.length === 0) continue;
        lines.push(`[${q.header || q.question}]: ${labels.join(", ")}`);
      }

      if (lines.length > 0) {
        const answerText = `[이전 질문에 대한 답변]\n${lines.join("\n")}`;
        sendPrompt(answerText, {
          mode: lastModeRef.current as SessionMode,
          skipAnswerPrepend: true,
        });
      }
    },
    [sendPrompt],
  );

  const stopExecution = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
    }
  }, []);

  const clearMessages = useCallback(() => {
    dispatch({ type: "CLEAR_MESSAGES" });
    lastSeqRef.current = 0;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "clear" }));
    }
  }, []);

  const addSystemMessage = useCallback((text: string) => {
    dispatch({ type: "ADD_SYSTEM_MESSAGE", text });
  }, []);

  const updateMessage = useCallback((id: string, patch: MessageUpdate) => {
    dispatch({ type: "UPDATE_MESSAGE", id, patch });
  }, []);

  const reconnect = useCallback(() => {
    reconnectAttempt.current = 0;
    dispatch({ type: "RECONNECT_RESET" });
    connect();
  }, [connect]);

  const updateSessionMode = useCallback((newMode: SessionMode) => {
    dispatch({ type: "UPDATE_SESSION_MODE", mode: newMode });
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
      dispatch({ type: "CLEAR_PENDING_PERMISSION" });
    },
    [],
  );

  // 대규모 대화(300+ 메시지) 시 오래된 메시지 텍스트 압축 (idle 시에만)
  useEffect(() => {
    dispatch({ type: "TRUNCATE_OLD_MESSAGES", maxFull: 300 });
  }, [state.status, state.messages.length]);

  return {
    connected: state.connected,
    loading: state.loading,
    messages: state.messages,
    status: state.status,
    sessionInfo: state.sessionInfo,
    fileChanges: state.fileChanges,
    activeTools: state.activeTools,
    pendingPermission: state.pendingPermission,
    reconnectState: state.reconnectState,
    tokenUsage: state.tokenUsage,
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
    confirmAndSendAnswers,
    updateSessionMode,
  };
}
