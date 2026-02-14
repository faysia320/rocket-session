/**
 * 로컬 Claude Code 세션 스캔 및 Import API 함수.
 */
import { api } from "./client";
import type {
  LocalSessionMeta,
  ImportLocalSessionRequest,
  ImportLocalSessionResponse,
} from "@/types";

export const localSessionsApi = {
  scan: (options?: { projectDir?: string; since?: string }) => {
    const searchParams = new URLSearchParams();
    if (options?.projectDir)
      searchParams.set("project_dir", options.projectDir);
    if (options?.since) searchParams.set("since", options.since);
    const qs = searchParams.toString();
    return api.get<LocalSessionMeta[]>(
      `/api/local-sessions/${qs ? `?${qs}` : ""}`,
    );
  },

  import: (req: ImportLocalSessionRequest) =>
    api.post<ImportLocalSessionResponse>("/api/local-sessions/import", req),
};
