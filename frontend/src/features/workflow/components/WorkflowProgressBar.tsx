import { memo, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { resolveWorkflowIcon } from "../utils/workflowIcons";
import type { WorkflowPhaseStatus, ResolvedWorkflowStep } from "@/types/workflow";

function getPhaseState(
  phaseKey: string,
  currentPhase: string | null,
  currentStatus: WorkflowPhaseStatus | null,
  orderedNames: string[],
): "done" | "active" | "waiting" {
  const currentIdx = currentPhase ? orderedNames.indexOf(currentPhase) : -1;
  const phaseIdx = orderedNames.indexOf(phaseKey);

  if (currentStatus === "completed") return "done";
  if (phaseIdx < currentIdx) return "done";
  if (phaseIdx === currentIdx) {
    if (currentStatus === "approved") return "done";
    return "active";
  }
  return "waiting";
}

interface WorkflowProgressBarProps {
  steps: ResolvedWorkflowStep[];
  currentPhase: string | null;
  currentStatus: WorkflowPhaseStatus | null;
  onPhaseClick?: (phase: string) => void;
}

export const WorkflowProgressBar = memo(function WorkflowProgressBar({
  steps,
  currentPhase,
  currentStatus,
  onPhaseClick,
}: WorkflowProgressBarProps) {
  const handleClick = useCallback(
    (phase: string) => {
      onPhaseClick?.(phase);
    },
    [onPhaseClick],
  );

  const sortedSteps = useMemo(
    () => [...steps].sort((a, b) => a.order_index - b.order_index),
    [steps],
  );
  const orderedNames = useMemo(() => sortedSteps.map((s) => s.name), [sortedSteps]);

  if (steps.length === 0) return null;

  return (
    <div
      role="navigation"
      aria-label="워크플로우 진행 상태"
      className="flex items-center justify-center gap-1 px-2 sm:px-4 py-2 border-b border-border bg-card/50"
    >
      {sortedSteps.map((step, idx) => {
        const state = getPhaseState(step.name, currentPhase, currentStatus, orderedNames);
        const isActive = step.name === currentPhase;
        const StepIcon = state === "done" ? Check : resolveWorkflowIcon(step.icon);

        return (
          <div key={step.name} className="flex items-center min-w-0">
            {idx > 0 ? (
              <div
                className={cn("w-4 sm:w-8 h-px mx-0.5 sm:mx-1 shrink-0", state === "waiting" ? "bg-muted" : "bg-primary/50")}
              />
            ) : null}
            <button
              type="button"
              onClick={() => handleClick(step.name)}
              disabled={state === "waiting"}
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-colors min-w-0",
                state === "done" && "bg-success/10 text-success hover:bg-success/20",
                state === "active" &&
                  currentStatus === "awaiting_approval" &&
                  "bg-warning/10 text-warning hover:bg-warning/20",
                state === "active" &&
                  currentStatus !== "awaiting_approval" &&
                  "bg-info/10 text-info hover:bg-info/20",
                state === "waiting" && "bg-muted/30 text-muted-foreground cursor-not-allowed",
              )}
            >
              <StepIcon
                className={cn(
                  "w-3.5 h-3.5 shrink-0",
                  state === "active" && currentStatus === "in_progress" && "animate-pulse",
                )}
              />
              <span className="truncate max-w-[4rem] sm:max-w-none">{step.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
});
