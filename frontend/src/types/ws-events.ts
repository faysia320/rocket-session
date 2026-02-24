/**
 * WebSocket 이벤트 discriminated union 타입 정의
 *
 * 백엔드 → 프론트엔드 방향의 모든 WS 메시지 타입을 정의합니다.
 * `type` 필드가 각 인터페이스의 discriminant 역할을 합니다.
 */

import type {
  AssistantTextMsg,
  ToolUseMsg,
  ResultMsg,
  FileChange,
  AskUserQuestionItem,
} from "./message";

// ---------------------------------------------------------------------------
// 공통 필드
// ---------------------------------------------------------------------------

interface WsBaseEvent {
  /** 이벤트 시퀀스 번호 (재연결 시 중복 방지용) */
  seq?: number;
}

// ---------------------------------------------------------------------------
// 세션 / 연결 관련 이벤트
// ---------------------------------------------------------------------------

/** 세션 상태 초기화 이벤트 (연결/재연결 직후 전송) */
export interface WsSessionStateEvent extends WsBaseEvent {
  type: "session_state";
  session: Record<string, unknown>;
  is_running: boolean;
  is_reconnect: boolean;
  history: Record<string, unknown>[] | null;
  latest_seq: number;
  current_turn_events: Record<string, unknown>[] | null;
  pending_interactions: {
    permission?: {
      permission_id: string;
      tool_name: string;
      tool_input: Record<string, unknown>;
    };
  } | null;
}

/** 누락된 이벤트 일괄 재전송 (재연결 후 last_seq 기반 복구) */
export interface WsMissedEventsEvent extends WsBaseEvent {
  type: "missed_events";
  events: Record<string, unknown>[];
}

/** Claude CLI 세션 ID 전달 */
export interface WsSessionInfoEvent extends WsBaseEvent {
  type: "session_info";
  claude_session_id: string;
}

// ---------------------------------------------------------------------------
// 실행 상태 이벤트
// ---------------------------------------------------------------------------

/** 세션 실행 상태 변경 */
export interface WsStatusEvent extends WsBaseEvent {
  type: "status";
  status: "idle" | "running" | "error";
}

/** 실행 중단 완료 */
export interface WsStoppedEvent extends WsBaseEvent {
  type: "stopped";
}

// ---------------------------------------------------------------------------
// 메시지 이벤트
// ---------------------------------------------------------------------------

/** 사용자 메시지 에코 */
export interface WsUserMessageEvent extends WsBaseEvent {
  type: "user_message";
  message?: Record<string, unknown>;
  prompt?: string;
  role?: string;
  content?: string;
  timestamp?: string;
}

/** Claude 어시스턴트 텍스트 스트리밍 */
export interface WsAssistantTextEvent extends WsBaseEvent, AssistantTextMsg {
  type: "assistant_text";
}

/** Claude 도구 사용 시작 */
export interface WsToolUseEvent extends WsBaseEvent, ToolUseMsg {
  type: "tool_use";
}

/** 도구 실행 결과 */
export interface WsToolResultEvent extends WsBaseEvent {
  type: "tool_result";
  tool_use_id: string;
  output: string;
  is_error: boolean;
  is_truncated?: boolean;
  full_length?: number;
  timestamp: string;
}

/** Claude 최종 응답 결과 (비용, 토큰 포함) */
export interface WsResultEvent extends WsBaseEvent, ResultMsg {
  type: "result";
  workflow_phase?: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
}

/** 파일 변경 감지 */
export interface WsFileChangeEvent extends WsBaseEvent {
  type: "file_change";
  change: FileChange;
}

// ---------------------------------------------------------------------------
// 진단 / 로그 이벤트
// ---------------------------------------------------------------------------

/** 오류 이벤트 */
export interface WsErrorEvent extends WsBaseEvent {
  type: "error";
  message: string;
  code?: string;
}

/** 표준 에러(stderr) 출력 */
export interface WsStderrEvent extends WsBaseEvent {
  type: "stderr";
  text: string;
}

/** 내부 thinking 이벤트 (extended thinking 모드) */
export interface WsThinkingEvent extends WsBaseEvent {
  type: "thinking";
  data: Record<string, unknown>;
}

/** 일반 이벤트 (확장 이벤트 컨테이너) */
export interface WsEventEvent extends WsBaseEvent {
  type: "event";
  event: Record<string, unknown>;
}

/** 원시 텍스트 출력 */
export interface WsRawEvent extends WsBaseEvent {
  type: "raw";
  text: string;
}

/** 시스템 메시지 */
export interface WsSystemEvent extends WsBaseEvent {
  type: "system";
  message: string;
}

/** 서버 ping 응답 */
export interface WsPongEvent extends WsBaseEvent {
  type: "pong";
}

// ---------------------------------------------------------------------------
// 사용자 인터랙션 이벤트
// ---------------------------------------------------------------------------

/** Claude CLI가 사용자에게 질문하는 이벤트 */
export interface WsAskUserQuestionEvent extends WsBaseEvent {
  type: "ask_user_question";
  questions: AskUserQuestionItem[];
  tool_use_id: string;
  timestamp: string;
}

/** 도구 사용 승인 요청 (Permission Mode) */
export interface WsPermissionRequestEvent extends WsBaseEvent {
  type: "permission_request";
  permission_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
}

/** 도구 사용 승인/거부 응답 */
export interface WsPermissionResponseEvent extends WsBaseEvent {
  type: "permission_response";
  reason?: string;
}

// ---------------------------------------------------------------------------
// 워크플로우 이벤트
// ---------------------------------------------------------------------------

/** 워크플로우 시작 */
export interface WsWorkflowStartedEvent extends WsBaseEvent {
  type: "workflow_started";
  phase: string;
}

/** 워크플로우 단계 완료 (승인 대기 상태 전환) */
export interface WsWorkflowPhaseCompletedEvent extends WsBaseEvent {
  type: "workflow_phase_completed";
  phase: string;
}

/** 워크플로우 단계 승인 */
export interface WsWorkflowPhaseApprovedEvent extends WsBaseEvent {
  type: "workflow_phase_approved";
  phase: string;
  next_phase: string | null;
}

/** 워크플로우 전체 완료 */
export interface WsWorkflowCompletedEvent extends WsBaseEvent {
  type: "workflow_completed";
}

/** 워크플로우 단계 수정 요청 */
export interface WsWorkflowPhaseRevisionEvent extends WsBaseEvent {
  type: "workflow_phase_revision";
  phase: string;
}

/** 워크플로우 아티팩트 업데이트 */
export interface WsWorkflowArtifactUpdatedEvent extends WsBaseEvent {
  type: "workflow_artifact_updated";
  artifact_id: number;
}

/** 워크플로우 주석 추가 */
export interface WsWorkflowAnnotationAddedEvent extends WsBaseEvent {
  type: "workflow_annotation_added";
  artifact_id: number;
}

// ---------------------------------------------------------------------------
// Discriminated union: 모든 WS 이벤트
// ---------------------------------------------------------------------------

export type WsEvent =
  | WsSessionStateEvent
  | WsMissedEventsEvent
  | WsSessionInfoEvent
  | WsStatusEvent
  | WsStoppedEvent
  | WsUserMessageEvent
  | WsAssistantTextEvent
  | WsToolUseEvent
  | WsToolResultEvent
  | WsResultEvent
  | WsFileChangeEvent
  | WsErrorEvent
  | WsStderrEvent
  | WsThinkingEvent
  | WsEventEvent
  | WsRawEvent
  | WsSystemEvent
  | WsPongEvent
  | WsAskUserQuestionEvent
  | WsPermissionRequestEvent
  | WsPermissionResponseEvent
  | WsWorkflowStartedEvent
  | WsWorkflowPhaseCompletedEvent
  | WsWorkflowPhaseApprovedEvent
  | WsWorkflowCompletedEvent
  | WsWorkflowPhaseRevisionEvent
  | WsWorkflowArtifactUpdatedEvent
  | WsWorkflowAnnotationAddedEvent;

/** WS 이벤트 type 필드 값의 union (편의 타입) */
export type WsEventType = WsEvent["type"];
