import { config } from '@/config/env';

// --- Reconnect constants ---
export const RECONNECT_MAX_ATTEMPTS = 10;
export const RECONNECT_BASE_DELAY = 1000;
export const RECONNECT_MAX_DELAY = 30000;

/**
 * WebSocket URL을 현재 페이지 기반으로 동적 생성.
 * Vite proxy를 통해 /ws 경로가 백엔드로 프록시됩니다.
 */
export function getWsUrl(sessionId: string, lastSeq?: number): string {
  const wsBase =
    config.WS_BASE_URL ||
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
  const base = `${wsBase}/ws/${sessionId}`;
  return lastSeq ? `${base}?last_seq=${lastSeq}` : base;
}

/**
 * 지수 백오프 + jitter로 재연결 딜레이 계산.
 */
export function getBackoffDelay(attempt: number): number {
  const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, attempt), RECONNECT_MAX_DELAY);
  return delay * (0.8 + Math.random() * 0.4);
}

// 메시지 고유 ID 생성기
let _msgIdCounter = 0;

export function generateMessageId(): string {
  return `msg-${Date.now()}-${++_msgIdCounter}`;
}

/** 테스트용: 카운터 리셋 */
export function resetMessageIdCounter(): void {
  _msgIdCounter = 0;
}
