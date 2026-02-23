import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Search, FileText, Code, Check } from "lucide-react";
import type { WorkflowPhase, WorkflowPhaseStatus } from "@/types/workflow";

const PHASES: { key: WorkflowPhase; label: string; icon: typeof Search }[] = [
  { key: "research", label: "Research", icon: Search },
  { key: "plan", label: "Plan", icon: FileText },
  { key: "implement", label: "Implement", icon: Code },
];

function getPhaseState(
  phaseKey: WorkflowPhase,
  currentPhase: WorkflowPhase | null,
  currentStatus: WorkflowPhaseStatus | null,
): "done" | "active" | "waiting" {
  const order = ["research", "plan", "implement"];
  const currentIdx = currentPhase ? order.indexOf(currentPhase) : -1;
  const phaseIdx = order.indexOf(phaseKey);

  if (phaseIdx < currentIdx) return "done";
  if (phaseIdx === currentIdx) {
    if (currentStatus === "approved") return "done";
    return "active";
  }
  return "waiting";
}

function getStatusLabel(status: WorkflowPhaseStatus | null): string {
  switch (status) {
    case "in_progress":
      return "진행 중";
    case "awaiting_approval":
      return "검토 대기";
    case "approved":
      return "승인됨";
    case "revision_requested":
      return "수정 요청됨";
    default:
      return "대기 중";
  }
}

interface WorkflowProgressBarProps {
  currentPhase: WorkflowPhase | null;
  currentStatus: WorkflowPhaseStatus | null;
  onPhaseClick?: (phase: WorkflowPhase) => void;
}

export const WorkflowProgressBar = memo(function WorkflowProgressBar({
  currentPhase,
  currentStatus,
  onPhaseClick,
}: WorkflowProgressBarProps) {
  const handleClick = useCallback(
    (phase: WorkflowPhase) => {
      onPhaseClick?.(phase);
    },
    [onPhaseClick],
  );

  return (
    <div
      role="navigation"
      aria-label="워크플로우 진행 상태"
      className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card/50"
    >
      {PHASES.map((phase, idx) => {
        const state = getPhaseState(phase.key, currentPhase, currentStatus);
        const isActive = phase.key === currentPhase;
        const Icon = state === "done" ? Check : phase.icon;

        return (
          <div key={phase.key} className="flex items-center">
            {idx > 0 ? (
              <div
                className={cn(
                  "w-8 h-px mx-1",
                  state === "waiting" ? "bg-muted" : "bg-primary/50",
                )}
              />
            ) : null}
            <button
              type="button"
              onClick={() => handleClick(phase.key)}
              disabled={state === "waiting"}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                state === "done" &&
                  "bg-success/10 text-success hover:bg-success/20",
                state === "active" &&
                  currentStatus === "awaiting_approval" &&
                  "bg-warning/10 text-warning hover:bg-warning/20",
                state === "active" &&
                  currentStatus !== "awaiting_approval" &&
                  "bg-info/10 text-info hover:bg-info/20",
                state === "waiting" &&
                  "bg-muted/30 text-muted-foreground cursor-not-allowed",
              )}
            >
              <Icon
                className={cn(
                  "w-3.5 h-3.5 shrink-0",
                  state === "active" &&
                    currentStatus === "in_progress" &&
                    "animate-pulse",
                )}
              />
              <span>{phase.label}</span>
              {isActive && currentStatus ? (
                <span className="text-[10px] opacity-75">
                  ({getStatusLabel(currentStatus)})
                </span>
              ) : null}
            </button>
          </div>
        );
      })}
    </div>
  );
});
