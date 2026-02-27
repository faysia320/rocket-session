export const contextKeys = {
  all: ["context"] as const,
  suggest: (workspaceId: string, prompt?: string) =>
    [...contextKeys.all, "suggest", workspaceId, prompt ?? ""] as const,
  recentSessions: (workspaceId: string) =>
    [...contextKeys.all, "recent-sessions", workspaceId] as const,
  suggestFiles: (workspaceId: string, prompt?: string) =>
    [...contextKeys.all, "suggest-files", workspaceId, prompt ?? ""] as const,
};
