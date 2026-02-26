import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  FileText,
  Code,
  Check,
  Wrench,
  TestTube,
  Eye,
  Palette,
  BookOpen,
  Hammer,
  CheckCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WorkflowPhaseStatus, ResolvedWorkflowStep } from "@/types/workflow";

const ICON_MAP: Record<string, LucideIcon> = {
  Search,
  FileText,
  Code,
  Wrench,
  TestTube,
  Eye,
  Palette,
  BookOpen,
  Hammer,
  CheckCircle,
};

function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? FileText;
}

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

  const sortedSteps = [...steps].sort((a, b) => a.order_index - b.order_index);
  const orderedNames = sortedSteps.map((s) => s.name);

  return (
    <div
      role="navigation"
      aria-label="워크플로우 진행 상태"
      className="flex items-center justify-center gap-1 px-4 py-2 border-b border-border bg-card/50"
    >
      {sortedSteps.map((step, idx) => {
        const state = getPhaseState(step.name, currentPhase, currentStatus, orderedNames);
        const isActive = step.name === currentPhase;
        const StepIcon = state === "done" ? Check : resolveIcon(step.icon);

        return (
          <div key={step.name} className="flex items-center">
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
              onClick={() => handleClick(step.name)}
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
              <StepIcon
                className={cn(
                  "w-3.5 h-3.5 shrink-0",
                  state === "active" &&
                    currentStatus === "in_progress" &&
                    "animate-pulse",
                )}
              />
              <span>{step.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
});
