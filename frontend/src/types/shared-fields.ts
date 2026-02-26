/**
 * ws-events.ts와 message.ts 간 공유되는 필드 인터페이스
 */

/** 토큰 사용량 필드 (ResultMsg, WsResultEvent 등에서 공유) */
export interface TokenFields {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
}

/** 도구 실행 결과 필드 (ToolResultMsg, WsToolResultEvent 등에서 공유) */
export interface ToolResultFields {
  tool_use_id?: string;
  output?: string;
  is_error?: boolean;
  is_truncated?: boolean;
  full_length?: number;
}
