import { memo } from "react";
import { cn } from "@/lib/utils";
import { ShieldAlert, ClipboardList } from "lucide-react";
import type { ToolUseMsg, PermissionRequestData } from "@/types";
import { getActivityLabel } from "../utils/activityLabel";

interface ActivityStatusBarProps {
  activeTools: ToolUseMsg[];
  status: "idle" | "running" | "error";
  pendingPermission?: PermissionRequestData | null;
  waitingForPlanApproval?: boolean;
}

export const ActivityStatusBar = memo(function ActivityStatusBar({
  activeTools,
  status,
  pendingPermission,
  waitingForPlanApproval,
}: ActivityStatusBarProps) {
  // 승인 대기 상태는 idle에서도 표시 (Plan 결과 수신 후 idle로 전환됨)
  const hasPermissionWait = !!pendingPermission;
  const hasPlanWait = !!waitingForPlanApproval;
  const hasActiveTools = activeTools.length > 0;
  const isRunning = status === "running";

  // 아무 표시할 내용이 없으면 null
  if (!hasPermissionWait && !hasPlanWait && !isRunning) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "px-4 py-1.5 border-t border-border animate-[fadeIn_0.15s_ease]",
        hasPermissionWait
          ? "bg-warning/10 border-warning/30"
          : hasPlanWait
            ? "bg-info/10 border-info/30"
            : "bg-secondary/50",
      )}
    >
      <div className="flex flex-col gap-0.5">
        {/* Permission 승인 대기 */}
        {hasPermissionWait ? (
          <div className="flex items-center gap-2 min-h-[20px]">
            <ShieldAlert className="w-3.5 h-3.5 text-warning animate-pulse shrink-0" />
            <span className="font-mono text-xs text-warning font-semibold">
              도구 사용 승인 대기 중 — {pendingPermission.tool_name}
            </span>
          </div>
        ) : null}

        {/* Plan 검토 대기 */}
        {hasPlanWait ? (
          <div className="flex items-center gap-2 min-h-[20px]">
            <ClipboardList className="w-3.5 h-3.5 text-info animate-pulse shrink-0" />
            <span className="font-mono text-xs text-info font-semibold">
              계획 검토 대기 중 — 아래에서 실행/수정을 선택하세요
            </span>
          </div>
        ) : null}

        {/* 도구 활동 표시 */}
        {hasActiveTools
          ? activeTools.map((tool, i) => (
              <div
                key={tool.tool_use_id || i}
                className="flex items-center gap-2 min-h-[20px]"
              >
                <span className="inline-block w-3 h-3 border-[1.5px] border-info/40 border-t-info rounded-full animate-spin shrink-0" />
                <span className="font-mono text-xs text-muted-foreground truncate">
                  {getActivityLabel(tool.tool || "Tool", tool.input)}
                </span>
              </div>
            ))
          : null}

        {/* running이지만 도구/승인 대기 없을 때: 기본 처리 중 표시 */}
        {isRunning && !hasActiveTools && !hasPermissionWait && !hasPlanWait ? (
          <div className="flex items-center gap-2 min-h-[20px]">
            <span className="inline-block w-3 h-3 border-[1.5px] border-primary/40 border-t-primary rounded-full animate-spin shrink-0" />
            <span className="font-mono text-xs text-muted-foreground">
              Claude가 처리 중…
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
});
