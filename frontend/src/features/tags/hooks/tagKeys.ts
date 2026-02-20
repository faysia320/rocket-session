export const tagKeys = {
  all: ["tags"] as const,
  list: () => [...tagKeys.all, "list"] as const,
  detail: (id: string) => [...tagKeys.all, "detail", id] as const,
  forSession: (sessionId: string) =>
    [...tagKeys.all, "session", sessionId] as const,
};
