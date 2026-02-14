/**
 * 중앙 환경변수 설정.
 * 개발 시 Vite proxy를 통해 /api, /ws 경로가 자동으로 백엔드로 프록시됩니다.
 */
export const config = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "",
  WS_BASE_URL: import.meta.env.VITE_WS_BASE_URL || "",
} as const;
