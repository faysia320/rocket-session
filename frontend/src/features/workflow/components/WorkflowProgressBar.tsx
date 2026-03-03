import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Settings2 } from "lucide-react";
import { resolveWorkflowIcon } from "../utils/workflowIcons";
import type { WorkflowPhaseStatus, ResolvedWorkflowStep } from "@/types/workflow";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { WorkflowDefinitionSelector } from "./WorkflowDefinitionSelector";
import { workflowApi } from "@/lib/api/workflow.api";

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
  /** 워크플로우 수동 변경 UI 활성화 */
  sessionId?: string;
  isRunning?: boolean;
  currentDefinitionId?: string | null;
  onWorkflowChanged?: () => void;
}

export const WorkflowProgressBar = memo(function WorkflowProgressBar({
  steps,
  currentPhase,
  currentStatus,
  onPhaseClick,
  sessionId,
  isRunning = false,
  currentDefinitionId,
  onWorkflowChanged,
}: WorkflowProgressBarProps) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(currentDefinitionId ?? null);

  // 외부에서 워크플로우가 변경(AI 추천 등)되면 selectedId 동기화
  useEffect(() => {
    setSelectedId(currentDefinitionId ?? null);
  }, [currentDefinitionId]);

  const handleClick = useCallback(
    (phase: string) => {
      onPhaseClick?.(phase);
    },
    [onPhaseClick],
  );

  const handleDefinitionSelect = useCallback(
    async (definitionId: string | null) => {
      if (!sessionId || !definitionId || definitionId === currentDefinitionId) {
        setOpen(false);
        return;
      }
      setSelectedId(definitionId);
      try {
        await workflowApi.startWorkflow(sessionId, { workflow_definition_id: definitionId });
        onWorkflowChanged?.();
      } catch {
        // 실패 시 원래 값 복원
        setSelectedId(currentDefinitionId ?? null);
      } finally {
        setOpen(false);
      }
    },
    [sessionId, currentDefinitionId, onWorkflowChanged],
  );

  const sortedSteps = useMemo(
    () => [...steps].sort((a, b) => a.order_index - b.order_index),
    [steps],
  );
  const orderedNames = useMemo(() => sortedSteps.map((s) => s.name), [sortedSteps]);

  if (steps.length === 0) return null;

  const showChangeButton = Boolean(sessionId);

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

      {showChangeButton ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={isRunning}
              aria-label="워크플로우 변경"
              className={cn(
                "ml-1 p-1 rounded-md transition-colors",
                isRunning
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="end">
            <p className="text-xs text-muted-foreground mb-2">워크플로우 변경</p>
            <WorkflowDefinitionSelector
              value={selectedId}
              onSelect={handleDefinitionSelect}
            />
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
});
