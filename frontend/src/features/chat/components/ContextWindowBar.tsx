import { memo, useMemo } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn, formatTokens } from "@/lib/utils";
import {
  getContextWindowSize,
  getModelDisplayName,
} from "@/lib/modelContextMap";

interface ContextWindowBarProps {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  messageCount?: number;
  model?: string | null;
}

export const ContextWindowBar = memo(function ContextWindowBar({
  inputTokens,
  outputTokens,
  cacheCreationTokens,
  cacheReadTokens,
  messageCount,
  model,
}: ContextWindowBarProps) {
  const maxTokens = getContextWindowSize(model);
  const modelName = getModelDisplayName(model);
  const total = inputTokens + outputTokens;
  if (total === 0) return null;
  const pct = Math.min((inputTokens / maxTokens) * 100, 100);
  const barColor =
    pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-warning" : "bg-info";

  const estimate = useMemo(() => {
    if (!messageCount || messageCount < 2 || inputTokens < 1000) return null;
    const tokensPerTurn = inputTokens / messageCount;
    if (tokensPerTurn <= 0) return null;
    const remainingTokens = maxTokens - inputTokens;
    const remainingTurns = Math.max(
      0,
      Math.floor(remainingTokens / tokensPerTurn),
    );
    return { tokensPerTurn, remainingTurns };
  }, [inputTokens, messageCount, maxTokens]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 cursor-default">
          {modelName ? (
            <span className="font-mono text-2xs text-info/70">
              {modelName}
            </span>
          ) : null}
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                barColor,
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span
            className={cn(
              "font-mono text-2xs",
              pct >= 90
                ? "text-destructive font-semibold"
                : pct >= 75
                  ? "text-warning"
                  : "text-muted-foreground",
            )}
          >
            {pct.toFixed(0)}%
          </span>
          {estimate && estimate.remainingTurns <= 5 ? (
            <span
              className={cn(
                "font-mono text-[9px] px-1 py-0.5 rounded",
                estimate.remainingTurns <= 2
                  ? "bg-destructive/15 text-destructive"
                  : "bg-warning/15 text-warning",
              )}
            >
              ~{estimate.remainingTurns}턴
            </span>
          ) : null}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="font-mono text-xs">
        <div className="space-y-0.5">
          {modelName ? (
            <div className="text-info font-semibold">{modelName}</div>
          ) : null}
          <div>Input: {formatTokens(inputTokens)}</div>
          <div>Output: {formatTokens(outputTokens)}</div>
          {cacheReadTokens > 0 ? (
            <div>Cache Read: {formatTokens(cacheReadTokens)}</div>
          ) : null}
          {cacheCreationTokens > 0 ? (
            <div>Cache Write: {formatTokens(cacheCreationTokens)}</div>
          ) : null}
          <div className="pt-0.5 border-t border-border text-muted-foreground">
            {formatTokens(inputTokens)} / {formatTokens(maxTokens)} context
          </div>
          {estimate ? (
            <div className="pt-0.5 border-t border-border">
              <div>
                평균 {formatTokens(Math.round(estimate.tokensPerTurn))}/턴
              </div>
              <div
                className={cn(
                  estimate.remainingTurns <= 2
                    ? "text-destructive"
                    : estimate.remainingTurns <= 5
                      ? "text-warning"
                      : "text-muted-foreground",
                )}
              >
                ~{estimate.remainingTurns}턴 남음 (예상)
              </div>
            </div>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});
