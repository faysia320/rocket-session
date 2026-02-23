export const teamKeys = {
  all: ["teams"] as const,
  list: (status?: string) => [...teamKeys.all, "list", status] as const,
  detail: (id: string) => [...teamKeys.all, "detail", id] as const,
  members: (id: string) => [...teamKeys.all, "members", id] as const,
  status: (id: string) => [...teamKeys.all, "status", id] as const,
  tasks: (teamId: string, status?: string) =>
    [...teamKeys.all, "tasks", teamId, status] as const,
  task: (teamId: string, taskId: number) =>
    [...teamKeys.all, "task", teamId, taskId] as const,
  messages: (teamId: string) =>
    [...teamKeys.all, "messages", teamId] as const,
};
