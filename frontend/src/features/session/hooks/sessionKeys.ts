export const sessionKeys = {
  all: ["sessions"] as const,
  list: () => [...sessionKeys.all, "list"] as const,
  detail: (id: string) => [...sessionKeys.all, "detail", id] as const,
  history: (id: string) => [...sessionKeys.all, "history", id] as const,
  files: (id: string) => [...sessionKeys.all, "files", id] as const,
  stats: (id: string) => [...sessionKeys.all, "stats", id] as const,
};
