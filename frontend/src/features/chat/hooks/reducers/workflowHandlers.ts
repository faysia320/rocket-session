/**
 * 워크플로우 관련 리듀서 핸들러: WS_WORKFLOW_*
 */
import type { ClaudeSocketState, ClaudeSocketAction } from "./types";

type WorkflowAction = Extract<
  ClaudeSocketAction,
  | { type: "WS_WORKFLOW_STARTED" }
  | { type: "WS_WORKFLOW_PHASE_COMPLETED" }
  | { type: "WS_WORKFLOW_PHASE_APPROVED" }
  | { type: "WS_WORKFLOW_PHASE_REVISION" }
  | { type: "WS_WORKFLOW_COMPLETED" }
  | { type: "WS_WORKFLOW_DATA_CHANGED" }
>;

export function handleWorkflow(
  state: ClaudeSocketState,
  action: WorkflowAction,
): ClaudeSocketState {
  switch (action.type) {
    case "WS_WORKFLOW_STARTED":
      return {
        ...state,
        sessionInfo: state.sessionInfo
          ? {
              ...state.sessionInfo,
              workflow_enabled: true,
              workflow_phase: action.phase,
              workflow_phase_status: "in_progress",
            }
          : state.sessionInfo,
      };

    case "WS_WORKFLOW_PHASE_COMPLETED":
      return {
        ...state,
        sessionInfo: state.sessionInfo
          ? {
              ...state.sessionInfo,
              workflow_phase: action.phase,
              workflow_phase_status: "awaiting_approval",
            }
          : state.sessionInfo,
      };

    case "WS_WORKFLOW_PHASE_REVISION":
      return {
        ...state,
        sessionInfo: state.sessionInfo
          ? {
              ...state.sessionInfo,
              workflow_phase: action.phase,
              workflow_phase_status: "in_progress",
            }
          : state.sessionInfo,
      };

    case "WS_WORKFLOW_DATA_CHANGED":
      // 아티팩트/주석 변경 신호 — 프론트엔드에서 TanStack Query invalidation 용도
      return state;

    case "WS_WORKFLOW_PHASE_APPROVED":
      return {
        ...state,
        sessionInfo: state.sessionInfo
          ? {
              ...state.sessionInfo,
              workflow_phase: action.nextPhase,
              workflow_phase_status: action.nextPhase ? "in_progress" : null,
            }
          : state.sessionInfo,
      };

    case "WS_WORKFLOW_COMPLETED":
      return {
        ...state,
        sessionInfo: state.sessionInfo
          ? {
              ...state.sessionInfo,
              workflow_phase: state.sessionInfo.workflow_phase ?? null,
              workflow_phase_status: "completed",
            }
          : state.sessionInfo,
      };
  }
}
