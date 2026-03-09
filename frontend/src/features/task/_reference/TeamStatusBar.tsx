import { memo } from "react";
import { cn } from "@/lib/utils";
import type { TaskSummary } from "@/types";

interface TeamStatusBarProps {
  taskSummary: TaskSummary;
  className?: string;
}

export const TeamStatusBar = memo(function TeamStatusBar({
  taskSummary,
  className,
}: TeamStatusBarProps) {
  const { total, completed, in_progress, failed } = taskSummary;
  if (total === 0) return null;

  const completedPct = (completed / total) * 100;
  const inProgressPct = (in_progress / total) * 100;
  const failedPct = (failed / total) * 100;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between font-mono text-2xs text-muted-foreground">
        <span>진행률</span>
        <span>
          {completed}/{total} 완료
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
        {completedPct > 0 ? (
          <div className="bg-success transition-all" style={{ width: `${completedPct}%` }} />
        ) : null}
        {inProgressPct > 0 ? (
          <div className="bg-info transition-all" style={{ width: `${inProgressPct}%` }} />
        ) : null}
        {failedPct > 0 ? (
          <div className="bg-destructive transition-all" style={{ width: `${failedPct}%` }} />
        ) : null}
      </div>
    </div>
  );
});
