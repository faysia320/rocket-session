import { memo } from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const MAX_TOKENS = 200_000;

interface ContextWindowBarProps {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
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
}: ContextWindowBarProps) {
  const total = inputTokens + outputTokens;
  if (total === 0) return null;
  const pct = Math.min((inputTokens / MAX_TOKENS) * 100, 100);
  const barColor = pct >= 90 ? 'bg-destructive' : pct >= 75 ? 'bg-warning' : 'bg-info';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 cursor-default">
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-300', barColor)}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {pct.toFixed(0)}%
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="font-mono text-xs">
        <div className="space-y-0.5">
          <div>Input: {formatTokens(inputTokens)}</div>
          <div>Output: {formatTokens(outputTokens)}</div>
          {cacheReadTokens > 0 ? <div>Cache Read: {formatTokens(cacheReadTokens)}</div> : null}
          {cacheCreationTokens > 0 ? <div>Cache Write: {formatTokens(cacheCreationTokens)}</div> : null}
          <div className="pt-0.5 border-t border-border text-muted-foreground">
            {formatTokens(inputTokens)} / {formatTokens(MAX_TOKENS)} context
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
});
