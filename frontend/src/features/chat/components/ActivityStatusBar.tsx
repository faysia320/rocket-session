import { cn } from "@/lib/utils";
import type { ToolUseMsg } from "@/types";

interface ActivityStatusBarProps {
  activeTools: ToolUseMsg[];
  status: "idle" | "running" | "error";
}

const TOOL_LABELS: Record<string, string> = {
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
};

function getActivityLabel(tool: ToolUseMsg): string {
  const toolName = tool.tool || "Tool";
  const label = TOOL_LABELS[toolName] || toolName;
  const input = tool.input || {};

  if (toolName === "Bash") {
    const cmd = (input.command as string) || "";
    const truncated = cmd.length > 50 ? cmd.slice(0, 50) + "\u2026" : cmd;
    return `${label} \`${truncated}\``;
  }

  if (toolName === "Task") {
    const desc = (input.description as string) || "";
    return desc ? `${label}: ${desc}` : label;
  }

  const filePath = (input.file_path as string) || (input.path as string) || "";
  if (filePath) {
    return `${label} ${shortenPath(filePath)}`;
  }

  const pattern = (input.pattern as string) || (input.query as string) || "";
  if (pattern) {
    return `${label} "${pattern}"`;
  }

  return label;
}

function shortenPath(fullPath: string): string {
  const segments = fullPath.replace(/\\/g, "/").split("/");
  if (segments.length <= 2) return fullPath;
  return "\u2026/" + segments.slice(-2).join("/");
}

export function ActivityStatusBar({
  activeTools,
  status,
}: ActivityStatusBarProps) {
  if (status !== "running" || activeTools.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "px-4 py-1.5 border-t border-border bg-secondary/50",
        "animate-[fadeIn_0.15s_ease]",
      )}
    >
      <div className="flex flex-col gap-0.5">
        {activeTools.map((tool, i) => (
          <div
            key={tool.tool_use_id || i}
            className="flex items-center gap-2 min-h-[20px]"
          >
            <span className="inline-block w-3 h-3 border-[1.5px] border-info/40 border-t-info rounded-full animate-spin shrink-0" />
            <span className="font-mono text-xs text-muted-foreground truncate">
              {getActivityLabel(tool)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
