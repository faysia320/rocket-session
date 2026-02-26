/**
 * 연결 관련 리듀서 핸들러: RESET_SESSION, SET_CONNECTED, SET_LOADING, WS_OPEN, RECONNECT_*
 */
import { RECONNECT_MAX_ATTEMPTS } from "../useClaudeSocket.utils";
import type { ClaudeSocketState, ClaudeSocketAction } from "./types";
import { initialState } from "./index";

type ConnectionAction = Extract<
  ClaudeSocketAction,
  | { type: "RESET_SESSION" }
  | { type: "SET_CONNECTED" }
  | { type: "SET_LOADING" }
  | { type: "WS_OPEN" }
  | { type: "RECONNECT_SCHEDULE" }
  | { type: "RECONNECT_FAILED" }
  | { type: "RECONNECT_RESET" }
>;

export function handleConnection(
  state: ClaudeSocketState,
  action: ConnectionAction,
): ClaudeSocketState {
  switch (action.type) {
    case "RESET_SESSION":
      return { ...initialState };

    case "SET_CONNECTED":
      return { ...state, connected: action.connected };

    case "SET_LOADING":
      return { ...state, loading: action.loading };

    case "WS_OPEN":
      return {
        ...state,
        connected: true,
        reconnectState: { status: "connected", attempt: 0, maxAttempts: RECONNECT_MAX_ATTEMPTS },
        activeTools: action.hadPriorSeq ? [] : state.activeTools,
      };

    case "RECONNECT_SCHEDULE":
      return {
        ...state,
        connected: false,
        reconnectState: {
          status: "reconnecting",
          attempt: action.attempt,
          maxAttempts: RECONNECT_MAX_ATTEMPTS,
        },
      };

    case "RECONNECT_FAILED":
      return {
        ...state,
        connected: false,
        reconnectState: {
          status: "failed",
          attempt: action.attempt,
          maxAttempts: RECONNECT_MAX_ATTEMPTS,
        },
      };

    case "RECONNECT_RESET":
      return {
        ...state,
        reconnectState: {
          status: "reconnecting",
          attempt: 0,
          maxAttempts: RECONNECT_MAX_ATTEMPTS,
        },
      };
  }
}
