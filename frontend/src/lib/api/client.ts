/**
 * API 클라이언트
 * Vite proxy를 활용하여 상대 경로로 요청합니다.
 * VITE_API_BASE_URL 환경변수로 외부 서버를 지정할 수 있습니다.
 */
import { config } from "@/config/env";

const DEFAULT_TIMEOUT_MS = 30_000;
const LONG_TIMEOUT_MS = 60_000;

/** HTTP 상태 코드를 포함하는 API 에러. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = config.API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
    parseResponse: (res: Response) => Promise<T> = (res) => res.json() as Promise<T>,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: HeadersInit = { ...options.headers };
    if (options.body && typeof options.body === "string") {
      (headers as Record<string, string>)["Content-Type"] = "application/json";
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Unknown error" }));
        throw new ApiError(
          error.detail || `HTTP ${response.status}`,
          response.status,
          error.detail,
        );
      }

      return parseResponse(response);
    } finally {
      clearTimeout(timer);
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  async getText(endpoint: string): Promise<string> {
    return this.request<string>(endpoint, {}, DEFAULT_TIMEOUT_MS, (res) => res.text());
  }

  async getBlob(endpoint: string): Promise<Blob> {
    return this.request<Blob>(endpoint, {}, LONG_TIMEOUT_MS, (res) => res.blob());
  }

  async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    return this.request<T>(endpoint, { method: "POST", body: formData }, LONG_TIMEOUT_MS);
  }

  async post<T>(endpoint: string, data?: unknown, timeoutMs?: number): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }, timeoutMs);
  }

  async put<T>(endpoint: string, data?: unknown, timeoutMs?: number): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }, timeoutMs);
  }

  async patch<T>(endpoint: string, data?: unknown, timeoutMs?: number): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }, timeoutMs);
  }

  async delete<T>(endpoint: string, timeoutMs?: number): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
    }, timeoutMs);
  }
}

export const api = new ApiClient();
