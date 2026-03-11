/**
 * 사용자 액션 리듀서 핸들러: ANSWER_QUESTION, CONFIRM_ANSWERS, MARK_ANSWERS_SENT,
 * CLEAR_MESSAGES, ADD_SYSTEM_MESSAGE, UPDATE_MESSAGE, CLEAR_PENDING_PERMISSION, TRUNCATE_OLD_MESSAGES
 */
import type { Message, AskUserQuestionMsg } from "@/types";
import { getMessageText } from "@/types";
import { generateMessageId } from "../useClaudeSocket.utils";
import type { ClaudeSocketState, ClaudeSocketAction } from "./types";

type UiAction = Extract<
  ClaudeSocketAction,
  | { type: "ANSWER_QUESTION" }
  | { type: "CONFIRM_ANSWERS" }
  | { type: "MARK_ANSWERS_SENT" }
  | { type: "CLEAR_MESSAGES" }
  | { type: "ADD_SYSTEM_MESSAGE" }
  | { type: "UPDATE_MESSAGE" }
  | { type: "CLEAR_PENDING_PERMISSION" }
  | { type: "TRUNCATE_OLD_MESSAGES" }
>;

export function handleUi(state: ClaudeSocketState, action: UiAction): ClaudeSocketState {
  switch (action.type) {
    case "ANSWER_QUESTION":
      return {
        ...state,
        messages: state.messages.map((m) => {
          if (m.id !== action.messageId || m.type !== "ask_user_question") return m;
          const msg = m as AskUserQuestionMsg;
          return {
            ...msg,
            answers: { ...msg.answers, [action.questionIndex]: action.selectedLabels },
          } as Message;
        }),
      };

    case "CONFIRM_ANSWERS": {
      // answered: false → true 전환 시 pendingAnswerCount 증가
      let delta = 0;
      const newMessages = state.messages.map((m) => {
        if (m.id !== action.messageId || m.type !== "ask_user_question") return m;
        const msg = m as AskUserQuestionMsg;
        if (!msg.answered && !msg.sent) {
          delta = 1;
        }
        return { ...m, answered: true } as Message;
      });
      return {
        ...state,
        messages: newMessages,
        pendingAnswerCount: state.pendingAnswerCount + delta,
      };
    }

    case "MARK_ANSWERS_SENT": {
      let count = 0;
      const newMessages = state.messages.map((m) => {
        if (
          m.type === "ask_user_question" &&
          (m as AskUserQuestionMsg).answered &&
          !(m as AskUserQuestionMsg).sent
        ) {
          count++;
          return { ...m, sent: true } as Message;
        }
        return m;
      });
      return {
        ...state,
        messages: newMessages,
        pendingAnswerCount: state.pendingAnswerCount - count,
      };
    }

    case "CLEAR_MESSAGES":
      return {
        ...state,
        messages: [],
        fileChanges: [],
        tokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        },
        pendingAnswerCount: 0,
        pinnedTodos: [],
        _pendingAssistantTextIdx: null,
        _orphanedToolResults: {},
        _toolUseIdMap: new Map(),
        sessionInfo: state.sessionInfo
          ? {
              ...state.sessionInfo,
              workflow_phase: null,
              workflow_phase_status: "in_progress",
            }
          : state.sessionInfo,
      };

    case "ADD_SYSTEM_MESSAGE":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: generateMessageId(), type: "system" as const, text: action.text },
        ],
      };

    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? ({ ...m, ...action.patch } as Message) : m,
        ),
      };

    case "CLEAR_PENDING_PERMISSION": {
      let msgs = state.messages;
      if (action.behavior) {
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (
            msgs[i].type === "permission_request" &&
            !(msgs[i] as import("@/types").PermissionRequestMsg).resolved
          ) {
            const updated = [...msgs];
            updated[i] = { ...msgs[i], resolved: true, resolution: action.behavior } as Message;
            msgs = updated;
            break;
          }
        }
      }
      return { ...state, pendingPermission: null, messages: msgs };
    }

    case "TRUNCATE_OLD_MESSAGES": {
      if (state.status !== "idle" || state.messages.length <= action.maxFull) return state;
      const cutoff = state.messages.length - action.maxFull;
      let changed = false;
      const updated = state.messages.map((m, i) => {
        const mText = getMessageText(m);
        if (i < cutoff && mText.length > 500 && !m._truncated) {
          changed = true;
          return {
            ...m,
            text:
              mText.slice(0, 200) + "\n\n\u2026 (이전 메시지, 전체 내용은 내보내기를 사용하세요)",
            _truncated: true,
          } as Message;
        }
        return m;
      });
      if (!changed) return state;
      // truncate 후 _pendingAssistantTextIdx가 잘린 범위에 해당하면 무효화
      const pendingIdx = state._pendingAssistantTextIdx;
      const safeIdx = pendingIdx !== null && pendingIdx < cutoff ? null : pendingIdx;
      return { ...state, messages: updated, _pendingAssistantTextIdx: safeIdx };
    }
  }
}
