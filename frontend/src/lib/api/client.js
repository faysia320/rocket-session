/**
 * 공통 API 클라이언트 (fetch 래퍼).
 * Vite proxy를 활용하여 상대 경로로 요청합니다.
 */
import { config } from '../../config/env';

const BASE_URL = config.API_BASE_URL;

export async function apiClient(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}
