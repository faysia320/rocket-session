export const TOOL_LABELS: Record<string, string> = {
  Read: "Reading",
  Write: "Writing",
  Edit: "Editing",
  MultiEdit: "Editing",
  Bash: "Running",
  Grep: "Searching",
  Glob: "Finding files",
  WebFetch: "Fetching",
  WebSearch: "Searching web",
  TodoRead: "Reading todos",
  TodoWrite: "Writing todos",
  Task: "Running task",
  __thinking__: "Thinking",
};

export function shortenPath(fullPath: string): string {
  const segments = fullPath.replace(/\\/g, "/").split("/");
  if (segments.length <= 2) return fullPath;
  return "\u2026/" + segments.slice(-2).join("/");
}

export function getActivityLabel(
  tool: string,
  input?: Record<string, unknown>,
): string {
  if (tool === "__thinking__") return "Thinking\u2026";

  const label = TOOL_LABELS[tool] || tool;

  if (tool === "Bash") {
    const cmd = (input?.command as string) || "";
    const truncated = cmd.length > 50 ? cmd.slice(0, 50) + "\u2026" : cmd;
    return `${label} \`${truncated}\``;
  }

  if (tool === "Task") {
    const desc = (input?.description as string) || "";
    return desc ? `${label}: ${desc}` : label;
  }

  const filePath =
    (input?.file_path as string) || (input?.path as string) || "";
  if (filePath) {
    return `${label} ${shortenPath(filePath)}`;
  }

  const pattern =
    (input?.pattern as string) || (input?.query as string) || "";
  if (pattern) {
    return `${label} "${pattern}"`;
  }

  return label;
}
