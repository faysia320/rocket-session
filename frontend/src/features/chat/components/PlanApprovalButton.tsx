import { Play, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PlanApprovalButtonProps {
  planExecuted?: boolean;
  isRunning: boolean;
  onExecute: () => void;
  onDismiss: () => void;
}

export function PlanApprovalButton({
  planExecuted,
  isRunning,
  onExecute,
  onDismiss,
}: PlanApprovalButtonProps) {
  if (planExecuted) {
    return (
      <Badge
        variant="outline"
        className="mt-2 gap-1.5 px-2.5 py-1 text-success border-success/30 bg-success/10 font-mono text-[11px]"
      >
        <CheckCircle2 className="h-3 w-3" />
        Executed
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <Button
        size="sm"
        onClick={onExecute}
        disabled={isRunning}
        className="font-mono text-xs font-semibold gap-1.5"
      >
        <Play className="h-3 w-3" />
        Execute Plan
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onDismiss}
        disabled={isRunning}
        className="font-mono text-xs text-muted-foreground gap-1.5"
      >
        <X className="h-3 w-3" />
        Dismiss
      </Button>
    </div>
  );
}
