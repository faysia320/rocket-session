import { memo, useMemo } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const MAX_TOKENS = 200_000;

interface ContextWindowBarProps {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  messageCount?: number;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export const ContextWindowBar = memo(function ContextWindowBar({
  inputTokens,
  outputTokens,
  cacheCreationTokens,
  cacheReadTokens,
  messageCount,
}: ContextWindowBarProps) {
  const total = inputTokens + outputTokens;
  if (total === 0) return null;
  const pct = Math.min((inputTokens / MAX_TOKENS) * 100, 100);
  const barColor =
    pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-warning" : "bg-info";

  const estimate = useMemo(() => {
    if (!messageCount || messageCount < 2 || inputTokens < 1000) return null;
    const tokensPerTurn = inputTokens / messageCount;
    if (tokensPerTurn <= 0) return null;
    const remainingTokens = MAX_TOKENS - inputTokens;
    const remainingTurns = Math.max(
      0,
      Math.floor(remainingTokens / tokensPerTurn),
    );
    return { tokensPerTurn, remainingTurns };
  }, [inputTokens, messageCount]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 cursor-default">
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
          <div>Input: {formatTokens(inputTokens)}</div>
          <div>Output: {formatTokens(outputTokens)}</div>
          {cacheReadTokens > 0 ? (
            <div>Cache Read: {formatTokens(cacheReadTokens)}</div>
          ) : null}
          {cacheCreationTokens > 0 ? (
            <div>Cache Write: {formatTokens(cacheCreationTokens)}</div>
          ) : null}
          <div className="pt-0.5 border-t border-border text-muted-foreground">
            {formatTokens(inputTokens)} / {formatTokens(MAX_TOKENS)} context
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
