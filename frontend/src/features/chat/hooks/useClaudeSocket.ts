import { useEffect, useRef, useReducer, useCallback } from "react";
import { isMobileDevice } from "@/lib/platform";
import type {
  Message,
  FileChange,
  PermissionRequestData,
  AssistantTextMsg,
  ToolUseMsg,
  AskUserQuestionMsg,
  AskUserQuestionItem,
  MessageUpdate,
} from "@/types";
import { getWsUrl, getBackoffDelay, RECONNECT_MAX_ATTEMPTS } from "./useClaudeSocket.utils";
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
          history: !data.is_reconnect && data.history ? (data.history as HistoryItem[]) : null,
          latestSeq: typeof data.latest_seq === "number" ? data.latest_seq : undefined,
          currentTurnEvents: null, // current_turn_events는 아래에서 별도 처리
          pendingInteractions:
            !data.is_reconnect && data.pending_interactions
              ? (data.pending_interactions as {
                  permission?: {
                    permission_id: string;
                    tool_name: string;
                    tool_input: Record<string, unknown>;
                  };
                  ask_user_question?: {
                    questions: AskUserQuestionItem[];
                    tool_use_id: string;
                    timestamp: string;
                  };
                })
              : null,
          fileChanges: data.file_changes ? (data.file_changes as FileChange[]) : null,
        };
        dispatch(action);

        // 대기 중인 AskUserQuestion 복원 (세션 전환/새로고침 후 카드 복구)
        if (
          !data.is_reconnect &&
          data.pending_interactions &&
          (data.pending_interactions as Record<string, unknown>).ask_user_question
        ) {
          const aq = (data.pending_interactions as Record<string, unknown>).ask_user_question as {
            questions: AskUserQuestionItem[];
            tool_use_id: string;
            timestamp: string;
          };
          dispatch({
            type: "WS_ASK_USER_QUESTION",
            questions: aq.questions,
            toolUseId: aq.tool_use_id,
            timestamp: aq.timestamp,
          });
        }

        // 현재 턴 이벤트가 있으면 순차 재생 (세션 전환/새로고침 후 복구)
        // latest_seq 업데이트 전에 수행하여 seq 중복 체크에 걸리지 않도록 함
        if (!data.is_reconnect && data.history && data.current_turn_events) {
          const turnEvents = data.current_turn_events as Record<string, unknown>[];
          for (const event of turnEvents) {
            // user_message: history에 이미 포함
            // permission_response: pending_interactions가 권위적 소스이므로 재생 건너뜀
            // status: SESSION_STATE의 is_running이 권위적 소스이므로 재생 건너뜀
            //   (과거의 "status: running" 이벤트가 재생되어 idle 세션이 running으로 보이는 버그 방지)
            if (
              event.type === "user_message" ||
              event.type === "permission_response" ||
              event.type === "status"
            )
              continue;
            // assistant_text: RAF 배치를 우회하여 직접 dispatch (재생은 동기적으로 빠르게
            // 발생하므로, RAF 경유 시 마지막 이벤트만 반영될 수 있음)
            if (event.type === "assistant_text") {
              dispatch({ type: "WS_ASSISTANT_TEXT", data: event as unknown as AssistantTextMsg });
              continue;
            }
            // result: history의 마지막 메시지와 중복 시 reducer에서 업그레이드 처리
            handleMessage(event);
          }
        }

        // latest_seq 업데이트는 모든 이벤트 재생 후 (seq 중복 방지 메커니즘 회피)
        if (typeof data.latest_seq === "number" && data.latest_seq > lastSeqRef.current) {
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
          workflowPhase: (data.workflow_phase as string) || null,
          inputTokens: (data.input_tokens as number) || 0,
          outputTokens: (data.output_tokens as number) || 0,
          cacheCreationTokens: (data.cache_creation_tokens as number) || 0,
          cacheReadTokens: (data.cache_read_tokens as number) || 0,
        });
        break;
      }

      case "error": {
        const isNotFound =
          data.code === "SESSION_NOT_FOUND" || data.message === "세션을 찾을 수 없습니다";
        dispatch({
          type: "WS_ERROR",
          data,
          isSessionNotFound: isNotFound,
        });
        if (isNotFound) {
          shouldReconnect.current = false;
        }
        break;
      }

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

      case "workflow_phase_completed":
        dispatch({
          type: "WS_WORKFLOW_PHASE_COMPLETED",
          phase: data.phase as string,
        });
        break;

      case "workflow_phase_approved":
        dispatch({
          type: "WS_WORKFLOW_PHASE_APPROVED",
          phase: data.phase as string,
          nextPhase: (data.next_phase as string) || null,
        });
        break;

      case "workflow_completed":
        dispatch({
          type: "WS_WORKFLOW_COMPLETED",
        });
        break;

      case "workflow_started":
        dispatch({
          type: "WS_WORKFLOW_STARTED",
          phase: data.phase as string,
        });
        break;

      case "workflow_phase_revision":
        dispatch({
          type: "WS_WORKFLOW_PHASE_REVISION",
          phase: data.phase as string,
        });
        break;

      case "workflow_auto_chain": {
        const fromPhase = data.from_phase as string;
        const toPhase = data.to_phase as string;
        const phaseLabels: Record<string, string> = {
          research: "조사",
          plan: "구현 계획 작성",
          implement: "구현",
        };
        const msg =
          `${phaseLabels[fromPhase] ?? fromPhase} 완료. ` +
          `${phaseLabels[toPhase] ?? toPhase}을(를) 시작합니다…`;
        dispatch({ type: "ADD_SYSTEM_MESSAGE", text: msg });
        break;
      }

      case "workflow_artifact_updated":
      case "workflow_annotation_added":
        // 아티팩트/주석 변경 → TanStack Query 캐시 무효화는 컴포넌트에서 처리
        dispatch({
          type: "WS_WORKFLOW_DATA_CHANGED",
          eventType: data.type as string,
          artifactId: data.artifact_id as number | undefined,
        });
        break;

      case "raw":
        dispatch({ type: "WS_RAW", text: data.text as string });
        break;

      case "system":
        if (typeof data.message === "string") {
          dispatch({ type: "ADD_SYSTEM_MESSAGE", text: data.message });
        }
        break;

      case "pong":
        // 서버 ping 응답 — 별도 처리 불필요 (visibility probe가 message 리스너로 감지)
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

  // 모바일 탭 백그라운드→포그라운드 전환 시 WebSocket 상태 점검 + 재연결
  useEffect(() => {
    let hiddenAt = 0;
    let probeTimeout: ReturnType<typeof setTimeout> | null = null;
    let probeListener: ((evt: MessageEvent) => void) | null = null;
    const isMobile = isMobileDevice();
    const HIDDEN_THRESHOLD = isMobile ? 2_000 : 5_000;

    const forceFullReconnect = () => {
      // lastSeqRef를 0으로 리셋 → 백엔드가 full history를 전송하도록 강제
      lastSeqRef.current = 0;
      reconnectAttempt.current = 0;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      const existingWs = wsRef.current;
      if (existingWs) {
        existingWs.onclose = null;
        existingWs.onerror = null;
        existingWs.close();
        wsRef.current = null;
      }
      dispatch({ type: "RECONNECT_RESET" });
      connect();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }

      // "visible" — 탭이 다시 보임
      const hiddenDuration = hiddenAt > 0 ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;

      if (hiddenDuration < HIDDEN_THRESHOLD) return;

      // 모바일: iOS가 WS를 공격적으로 kill하므로 항상 full reconnect
      if (isMobile) {
        console.log(
          "[Visibility] Mobile return after",
          hiddenDuration,
          "ms, forcing full reconnect",
        );
        forceFullReconnect();
        return;
      }

      // 데스크톱: 기존 ping probe 로직 유지
      const ws = wsRef.current;

      // Case 1: WS가 이미 닫혀 있거나 없음
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.log("[Visibility] WS not open, forcing reconnect");
        reconnectAttempt.current = 0;
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
          reconnectTimer.current = null;
        }
        dispatch({ type: "RECONNECT_RESET" });
        connect();
        return;
      }

      // Case 2: WS는 OPEN이지만 stale일 수 있음 → ping 프로브
      try {
        ws.send(JSON.stringify({ type: "ping" }));
      } catch {
        console.log("[Visibility] WS send failed, forcing reconnect");
        reconnectAttempt.current = 0;
        dispatch({ type: "RECONNECT_RESET" });
        connect();
        return;
      }

      // 3초 내 아무 메시지 수신 여부로 연결 상태 판단
      probeTimeout = setTimeout(() => {
        if (wsRef.current === ws && ws.readyState === WebSocket.OPEN) {
          console.log("[Visibility] WS stale (no response in 3s), forcing reconnect");
          // 기존 WS를 먼저 정리 후 재연결
          ws.onclose = null;
          ws.onerror = null;
          ws.close();
          wsRef.current = null;
          reconnectAttempt.current = 0;
          dispatch({ type: "RECONNECT_RESET" });
          connect();
        }
        probeTimeout = null;
      }, 3_000);

      // 어떤 메시지든 수신 시 프로브 성공 (pong뿐 아니라 running 중인 이벤트도 포함)
      probeListener = () => {
        if (probeTimeout) {
          clearTimeout(probeTimeout);
          probeTimeout = null;
        }
        if (probeListener) {
          ws.removeEventListener("message", probeListener);
          probeListener = null;
        }
        console.log("[Visibility] WS probe succeeded, connection alive");
      };
      ws.addEventListener("message", probeListener);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (probeTimeout) clearTimeout(probeTimeout);
      if (probeListener && wsRef.current) {
        wsRef.current.removeEventListener("message", probeListener);
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

  const sendPrompt = useCallback(
    (
      prompt: string,
      options?: {
        allowedTools?: string[];
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

        wsRef.current.send(
          JSON.stringify({
            type: "prompt",
            prompt: finalPrompt,
            allowed_tools: options?.allowedTools,
            images: options?.images,
          }),
        );
      }
    },

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

  const respondPermission = useCallback(
    (
      permissionId: string,
      behavior: "allow" | "deny",
      trustLevel?: "once" | "session" | "always",
    ) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "permission_respond",
            permission_id: permissionId,
            behavior,
            trust_level: trustLevel || "once",
          }),
        );
      }
      dispatch({ type: "CLEAR_PENDING_PERMISSION", behavior });
    },
    [],
  );

  // 대규모 대화(300+ 메시지) 시 오래된 메시지 텍스트 압축 (idle 전환 시에만)
  useEffect(() => {
    if (state.status === "idle" && state.messages.length > 300) {
      dispatch({ type: "TRUNCATE_OLD_MESSAGES", maxFull: 300 });
    }
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
    pendingAnswerCount: state.pendingAnswerCount,
    pinnedTodos: state.pinnedTodos,
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
  };
}
