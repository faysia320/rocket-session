export const insightKeys = {
  all: ["insights"] as const,
  list: (workspaceId: string) => [...insightKeys.all, "list", workspaceId] as const,
  listByCategory: (workspaceId: string, category: string) =>
    [...insightKeys.all, "list", workspaceId, category] as const,
  context: (workspaceId: string, prompt?: string) =>
    [...insightKeys.all, "context", workspaceId, prompt ?? ""] as const,
};
