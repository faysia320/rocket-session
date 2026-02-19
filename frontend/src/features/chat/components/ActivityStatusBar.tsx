import { cn } from "@/lib/utils";
import type { ToolUseMsg } from "@/types";
import { getActivityLabel } from "../utils/activityLabel";

interface ActivityStatusBarProps {
  activeTools: ToolUseMsg[];
  status: "idle" | "running" | "error";
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
              {getActivityLabel(tool.tool || "Tool", tool.input)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
