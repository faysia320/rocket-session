/**
 * WebSocket 메시지 리듀서 핸들러: WS_SESSION_STATE, WS_SESSION_INFO, WS_STATUS,
 * WS_USER_MESSAGE, WS_ASSISTANT_TEXT, WS_TOOL_USE, WS_TOOL_RESULT,
 * WS_FILE_CHANGE, WS_RESULT, WS_ERROR, WS_STDERR, WS_STOPPED,
 * WS_THINKING, WS_EVENT, WS_ASK_USER_QUESTION, WS_PERMISSION_REQUEST,
 * WS_PERMISSION_RESPONSE, WS_RAW
 */
import type { Message, ToolUseMsg, AssistantTextMsg, ResultMsg, AskUserQuestionMsg } from "@/types";
import { generateMessageId } from "../useClaudeSocket.utils";
import type { ClaudeSocketState, ClaudeSocketAction, TodoItem } from "./types";
import { recomputePendingAnswerCount } from "./types";

type WsMessageAction = Extract<
  ClaudeSocketAction,
  | { type: "WS_SESSION_STATE" }
  | { type: "WS_SESSION_INFO" }
  | { type: "WS_STATUS" }
  | { type: "WS_USER_MESSAGE" }
  | { type: "WS_ASSISTANT_TEXT" }
  | { type: "WS_TOOL_USE" }
  | { type: "WS_TOOL_RESULT" }
  | { type: "WS_FILE_CHANGE" }
  | { type: "WS_RESULT" }
  | { type: "WS_ERROR" }
  | { type: "WS_STDERR" }
  | { type: "WS_STOPPED" }
  | { type: "WS_THINKING" }
  | { type: "WS_EVENT" }
  | { type: "WS_ASK_USER_QUESTION" }
  | { type: "WS_PERMISSION_REQUEST" }
  | { type: "WS_PERMISSION_RESPONSE" }
  | { type: "WS_RAW" }
>;

export function handleWsMessage(
  state: ClaudeSocketState,
  action: WsMessageAction,
): ClaudeSocketState {
  switch (action.type) {
    case "WS_SESSION_STATE": {
      let newMessages = state.messages;
      let newTokenUsage = state.tokenUsage;
      let lastTodoWriteTodos: TodoItem[] = [];
      const newStatus = action.isRunning ? ("running" as const) : state.status;

      if (!action.isReconnect && action.history) {
        // tool_result를 tool_use_id로 인덱싱 (tool_use 메시지에 병합용)
        const toolResultMap = new Map<string, (typeof action.history)[number]>();
        for (const h of action.history) {
          if (h.message_type === "tool_result" && h.tool_use_id) {
            toolResultMap.set(h.tool_use_id, h);
          }
        }

        newMessages = action.history
          .filter((h) => h.message_type !== "tool_result")
          .map((h, index) => {
            if (h.message_type === "tool_use") {
              const result = h.tool_use_id ? toolResultMap.get(h.tool_use_id) : undefined;
              return {
                id: `hist-${index}`,
                type: "tool_use" as const,
                tool: h.tool_name || "Tool",
                input: h.tool_input || {},
                tool_use_id: h.tool_use_id || "",
                status: "done" as const,
                output: result?.content,
                is_error: result ? Boolean(result.is_error) : false,
                timestamp: h.timestamp,
              } as Message;
            }

            if (h.role === "user") {
              return {
                id: `hist-${index}`,
                type: "user_message" as const,
                message: h as unknown as Record<string, unknown>,
                text: h.content,
                content: h.content,
                timestamp: h.timestamp,
              } as Message;
            }

            return {
              id: `hist-${index}`,
              type: "result" as const,
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
            } as Message;
          });

        // TodoWrite 메시지를 필터링하고 마지막 TodoWrite의 todos를 pinnedTodos로 설정
        newMessages = newMessages.filter((m) => {
          if (m.type === "tool_use" && (m as ToolUseMsg).tool === "TodoWrite") {
            const input = (m as ToolUseMsg).input;
            if (Array.isArray(input?.todos)) lastTodoWriteTodos = input.todos as TodoItem[];
            return false;
          }
          return true;
        });

        // 세션이 이미 완료된 상태(idle/error)라면 잔여 todo를 전체 completed 처리
        if (!action.isRunning && lastTodoWriteTodos.length > 0) {
          lastTodoWriteTodos = lastTodoWriteTodos.map((t) =>
            t.status !== "completed" ? { ...t, status: "completed" as const } : t
          );
        }

        // 토큰 집계
        let totalIn = 0,
          totalOut = 0,
          totalCacheCreate = 0,
          totalCacheRead = 0;
        for (const h of action.history) {
          if (!h.message_type) {
            totalIn += h.input_tokens || 0;
            totalOut += h.output_tokens || 0;
            totalCacheCreate += h.cache_creation_tokens || 0;
            totalCacheRead += h.cache_read_tokens || 0;
          }
        }
        newTokenUsage = {
          inputTokens: totalIn,
          outputTokens: totalOut,
          cacheCreationTokens: totalCacheCreate,
          cacheReadTokens: totalCacheRead,
        };
      }

      let newPendingPermission = state.pendingPermission;
      if (action.pendingInteractions?.permission) {
        const p = action.pendingInteractions.permission;
        newPendingPermission = {
          permission_id: p.permission_id,
          tool_name: p.tool_name,
          tool_input: p.tool_input,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        ...state,
        sessionInfo: action.session,
        loading: false,
        status: newStatus,
        messages: newMessages,
        tokenUsage: newTokenUsage,
        pendingPermission: newPendingPermission,
        pendingAnswerCount: recomputePendingAnswerCount(newMessages),
        ...(action.history ? { pinnedTodos: lastTodoWriteTodos } : {}),
        ...(action.fileChanges ? { fileChanges: action.fileChanges } : {}),
      };
    }

    case "WS_SESSION_INFO":
      return {
        ...state,
        sessionInfo: { ...state.sessionInfo, claude_session_id: action.claudeSessionId },
      };

    case "WS_STATUS": {
      // preparing: running과 동일하게 취급 (activeTools 초기화 안 함)
      if (action.status === "idle" || action.status === "error") {
        const runningIndices: number[] = [];
        for (let i = state.messages.length - 1; i >= 0; i--) {
          const m = state.messages[i];
          if (m.type === "user_message" || m.type === "result") break;
          if (m.type === "tool_use" && m.status === "running") {
            runningIndices.push(i);
          }
        }
        // idle/error 시 잔여 todo 전체 completed 처리 (in_progress + pending 모두)
        const todosUpdated = state.pinnedTodos.some((t) => t.status !== "completed")
          ? state.pinnedTodos.map((t) =>
              t.status !== "completed" ? { ...t, status: "completed" as const } : t
            )
          : state.pinnedTodos;
        if (runningIndices.length === 0) {
          return { ...state, status: action.status, activeTools: [], pinnedTodos: todosUpdated };
        }
        const updated = [...state.messages];
        for (const idx of runningIndices) {
          updated[idx] = { ...updated[idx], status: "done" as const } as Message;
        }
        return { ...state, status: action.status, activeTools: [], messages: updated, pinnedTodos: todosUpdated };
      }
      return { ...state, status: action.status };
    }

    case "WS_USER_MESSAGE": {
      const userMsg = action.data.message as
        | { content?: string; prompt?: string; timestamp?: string }
        | undefined;
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: generateMessageId(),
            type: "user_message" as const,
            content: userMsg?.content || String(action.data.prompt || ""),
            timestamp: userMsg?.timestamp || new Date().toISOString(),
            message: userMsg,
          },
        ],
      };
    }

    case "WS_ASSISTANT_TEXT": {
      const prev = state.messages;
      let lastIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        const t = prev[i].type;
        if (t === "user_message" || t === "result" || t === "tool_use" || t === "tool_result")
          break;
        if (t === "assistant_text") {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx >= 0) {
        const existing = prev[lastIdx] as AssistantTextMsg;
        if (existing.text === action.data.text) return state;
        const newMsg = { ...action.data, id: prev[lastIdx].id };
        if (lastIdx === prev.length - 1) {
          return { ...state, messages: [...prev.slice(0, -1), newMsg], _pendingAssistantTextIdx: lastIdx };
        }
        const updated = [...prev];
        updated[lastIdx] = newMsg;
        return { ...state, messages: updated, _pendingAssistantTextIdx: lastIdx };
      }
      return {
        ...state,
        messages: [...prev, { ...action.data, id: generateMessageId() } as Message],
        _pendingAssistantTextIdx: prev.length,
      };
    }

    case "WS_TOOL_USE": {
      if (action.data.tool === "TodoWrite") {
        const todos = Array.isArray(action.data.input?.todos)
          ? (action.data.input.todos as TodoItem[])
          : [];
        return {
          ...state,
          pinnedTodos: todos,
          activeTools: [...state.activeTools, action.data],
        };
      }
      // orphaned buffer에서 대응하는 tool_result 확인
      const toolUseId = action.data.tool_use_id;
      const orphaned = toolUseId ? state._orphanedToolResults[toolUseId] : undefined;
      const newOrphans = orphaned
        ? (({ [toolUseId]: _, ...rest }) => rest)(state._orphanedToolResults)
        : state._orphanedToolResults;

      return {
        ...state,
        messages: [
          ...state.messages,
          {
            ...action.data,
            id: generateMessageId(),
            status: orphaned ? (orphaned.isError ? ("error" as const) : ("done" as const)) : ("running" as const),
            ...(orphaned && {
              output: orphaned.output,
              is_error: orphaned.isError,
              is_truncated: orphaned.isTruncated,
              full_length: orphaned.fullLength,
              completed_at: orphaned.timestamp,
            }),
          },
        ],
        activeTools: orphaned ? state.activeTools : [...state.activeTools, action.data],
        _orphanedToolResults: newOrphans,
      };
    }

    case "WS_TOOL_RESULT": {
      const msgs = state.messages;
      let targetIdx = -1;
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.type === "tool_use" && m.tool_use_id === action.toolUseId && m.status === "running") {
          targetIdx = i;
          break;
        }
      }
      if (targetIdx < 0) {
        // orphaned tool_result: tool_use보다 먼저 도착 → 버퍼에 저장
        const buffer = { ...state._orphanedToolResults };
        buffer[action.toolUseId] = {
          output: action.output,
          isError: action.isError,
          isTruncated: action.isTruncated,
          fullLength: action.fullLength,
          timestamp: action.timestamp,
        };
        // FIFO: 20개 초과 시 가장 오래된 항목 제거
        const keys = Object.keys(buffer);
        if (keys.length > 20) {
          delete buffer[keys[0]];
        }
        return {
          ...state,
          _orphanedToolResults: buffer,
          activeTools: state.activeTools.filter((t) => t.tool_use_id !== action.toolUseId),
        };
      }
      const updatedMsgs = [...msgs];
      updatedMsgs[targetIdx] = {
        ...msgs[targetIdx],
        status: action.isError ? "error" : "done",
        output: action.output,
        is_error: action.isError,
        is_truncated: action.isTruncated,
        full_length: action.fullLength,
        completed_at: action.timestamp,
      } as Message;
      return {
        ...state,
        messages: updatedMsgs,
        activeTools: state.activeTools.filter((t) => t.tool_use_id !== action.toolUseId),
      };
    }

    case "WS_FILE_CHANGE": {
      const MAX_FILE_CHANGES = 500;
      const newChanges = [...state.fileChanges, action.change];
      return {
        ...state,
        fileChanges:
          newChanges.length > MAX_FILE_CHANGES
            ? newChanges.slice(newChanges.length - MAX_FILE_CHANGES)
            : newChanges,
      };
    }

    case "WS_RESULT": {
      const prev = state.messages;

      const lastMsg = prev.length > 0 ? prev[prev.length - 1] : null;
      if (
        lastMsg &&
        lastMsg.type === "result" &&
        lastMsg.id.startsWith("hist-") &&
        !(lastMsg as ResultMsg).workflow_phase
      ) {
        const text = action.data.text || (lastMsg as ResultMsg).text;
        const upgraded = {
          ...lastMsg,
          workflow_phase: action.workflowPhase,
          text,
        } as Message;

        return {
          ...state,
          messages: [...prev.slice(0, -1), upgraded],
          _pendingAssistantTextIdx: null,
        };
      }

      // _pendingAssistantTextIdx를 사용하여 정확한 assistant_text 참조 (레이스 컨디션 방지)
      const pendingIdx = state._pendingAssistantTextIdx;
      const lastAssistantIdx =
        pendingIdx !== null &&
        pendingIdx < prev.length &&
        prev[pendingIdx].type === "assistant_text"
          ? pendingIdx
          : -1;
      const assistantText =
        lastAssistantIdx >= 0 ? (prev[lastAssistantIdx] as AssistantTextMsg).text : undefined;
      const cleaned =
        lastAssistantIdx >= 0
          ? [...prev.slice(0, lastAssistantIdx), ...prev.slice(lastAssistantIdx + 1)]
          : prev;
      const text = action.data.text || assistantText;

      const newTokenUsage =
        action.inputTokens || action.outputTokens
          ? {
              inputTokens: state.tokenUsage.inputTokens + action.inputTokens,
              outputTokens: state.tokenUsage.outputTokens + action.outputTokens,
              cacheCreationTokens:
                state.tokenUsage.cacheCreationTokens + action.cacheCreationTokens,
              cacheReadTokens: state.tokenUsage.cacheReadTokens + action.cacheReadTokens,
            }
          : state.tokenUsage;

      return {
        ...state,
        messages: [
          ...cleaned,
          {
            ...action.data,
            text,
            id: generateMessageId(),
            workflow_phase: action.workflowPhase,
          } as Message,
        ],
        tokenUsage: newTokenUsage,
        _pendingAssistantTextIdx: null,
      };
    }

    case "WS_ERROR":
      return {
        ...state,
        messages: [
          ...state.messages,
          { ...(action.data as unknown as Message), id: generateMessageId() },
        ],
        status: action.isSessionNotFound ? state.status : "error",
      };

    case "WS_STDERR":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: generateMessageId(), type: "stderr", text: action.text },
        ],
      };

    case "WS_STOPPED": {
      const msgs = state.messages;
      const runningIndices: number[] = [];
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.type === "user_message" || m.type === "result") break;
        if (m.type === "tool_use" && m.status === "running") {
          runningIndices.push(i);
        }
      }
      // 세션 중지 시 잔여 todo 전체 completed 처리
      const stoppedTodos = state.pinnedTodos.some((t) => t.status !== "completed")
        ? state.pinnedTodos.map((t) =>
            t.status !== "completed" ? { ...t, status: "completed" as const } : t
          )
        : state.pinnedTodos;
      const systemMsg = {
        id: generateMessageId(),
        type: "system" as const,
        text: "Session stopped by user.",
      };
      if (runningIndices.length === 0) {
        return {
          ...state,
          status: "idle",
          activeTools: [],
          messages: [...msgs, systemMsg],
          pinnedTodos: stoppedTodos,
        };
      }
      const updated = [...msgs];
      for (const idx of runningIndices) {
        updated[idx] = { ...msgs[idx], status: "done" as const } as Message;
      }
      return {
        ...state,
        status: "idle",
        activeTools: [],
        messages: [...updated, systemMsg],
        pinnedTodos: stoppedTodos,
      };
    }

    case "WS_THINKING": {
      const prev = state.messages;
      let lastIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        const t = prev[i].type;
        if (t === "user_message" || t === "result" || t === "tool_use" || t === "tool_result")
          break;
        if (t === "thinking") {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx >= 0) {
        const updated = [...prev];
        updated[lastIdx] = { ...(action.data as unknown as Message), id: prev[lastIdx].id };
        return { ...state, messages: updated };
      }
      return {
        ...state,
        messages: [...prev, { ...(action.data as unknown as Message), id: generateMessageId() }],
      };
    }

    case "WS_EVENT":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: generateMessageId(), type: "event", event: action.event },
        ],
      };

    case "WS_ASK_USER_QUESTION":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: generateMessageId(),
            type: "ask_user_question",
            questions: action.questions,
            tool_use_id: action.toolUseId,
            answers: {},
            answered: false,
            sent: false,
            timestamp: action.timestamp,
          } as AskUserQuestionMsg,
        ],
      };

    case "WS_PERMISSION_REQUEST":
      return {
        ...state,
        pendingPermission: action.permData,
        messages: [
          ...state.messages,
          {
            id: generateMessageId(),
            type: "permission_request",
            tool: action.permData.tool_name,
            input: action.permData.tool_input,
            timestamp: action.permData.timestamp,
          },
        ],
      };

    case "WS_PERMISSION_RESPONSE": {
      let msgs = state.messages;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (
          msgs[i].type === "permission_request" &&
          !(msgs[i] as import("@/types").PermissionRequestMsg).resolved
        ) {
          const updated = [...msgs];
          updated[i] = {
            ...msgs[i],
            resolved: true,
            resolution: action.reason === "denied" ? "deny" : "allow",
          } as Message;
          msgs = updated;
          break;
        }
      }
      if (action.reason) {
        msgs = [
          ...msgs,
          {
            id: generateMessageId(),
            type: "system" as const,
            text: `Permission: ${action.reason}`,
          },
        ];
      }
      return { ...state, pendingPermission: null, messages: msgs };
    }

    case "WS_RAW":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: generateMessageId(), type: "stderr", text: action.text },
        ],
      };
  }
}
