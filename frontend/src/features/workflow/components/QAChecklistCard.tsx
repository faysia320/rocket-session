import { memo } from "react";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { QAChecklistResult, QAStatus } from "@/types/workflow";

const STATUS_CONFIG: Record<QAStatus, { icon: typeof CheckCircle; color: string; label: string }> =
  {
    pass: { icon: CheckCircle, color: "text-success", label: "PASS" },
    fail: { icon: XCircle, color: "text-destructive", label: "FAIL" },
    warn: { icon: AlertTriangle, color: "text-warning", label: "WARN" },
  };

interface QAChecklistCardProps {
  result: QAChecklistResult;
}

export const QAChecklistCard = memo(function QAChecklistCard({ result }: QAChecklistCardProps) {
  const { items, summary, all_passed } = result;

  return (
    <div className="space-y-3">
      {/* Summary badge */}
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "font-mono text-xs border",
            all_passed
              ? "text-success border-success/30 bg-success/10"
              : "text-destructive border-destructive/30 bg-destructive/10",
          )}
        >
          {all_passed ? "All Passed" : "Issues Found"}
        </Badge>
        <span className="font-mono text-2xs text-muted-foreground">
          {summary.pass}/{items.length} passed
          {summary.fail > 0 ? `, ${summary.fail} failed` : ""}
          {summary.warn > 0 ? `, ${summary.warn} warnings` : ""}
        </span>
      </div>

      {/* Checklist items */}
      <div className="space-y-1.5">
        {items.map((item, idx) => {
          const config = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.warn;
          const Icon = config.icon;
          return (
            <div key={idx} className="flex items-start gap-2 px-2 py-1.5 rounded-sm bg-muted/30">
              <Icon className={cn("w-3.5 h-3.5 shrink-0 mt-0.5", config.color)} />
              <div className="flex-1 min-w-0">
                <span className="font-mono text-xs text-foreground">{item.item}</span>
                {item.detail ? (
                  <p className="font-mono text-2xs text-muted-foreground mt-0.5">{item.detail}</p>
                ) : null}
              </div>
              <Badge
                variant="secondary"
                className={cn("font-mono text-2xs shrink-0", config.color)}
              >
                {config.label}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
});
