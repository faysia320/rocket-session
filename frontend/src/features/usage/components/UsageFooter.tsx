import { Crown, Flame, Clock, AlertCircle } from 'lucide-react';
import { useUsage } from '../hooks/useUsage';
import { cn } from '@/lib/utils';

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return String(tokens);
}

export function UsageFooter() {
  const { data, isLoading, isError } = useUsage();

  if (isLoading) {
    return (
      <footer className="h-8 shrink-0 border-t border-border bg-card flex items-center px-3">
        <div className="h-3 w-48 animate-pulse rounded bg-muted" />
      </footer>
    );
  }

  if (isError || !data || !data.available) {
    return (
      <footer className="h-8 shrink-0 border-t border-border bg-card flex items-center px-3 gap-1.5 text-xs text-muted-foreground">
        <AlertCircle className="h-3 w-3" />
        <span>{data?.error ? data.error : '사용량 정보를 가져올 수 없습니다'}</span>
      </footer>
    );
  }

  const { plan, block_5h, weekly } = data;

  return (
    <footer className="h-8 shrink-0 border-t border-border bg-card flex items-center px-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        {/* 플랜 배지 */}
        <span className="flex items-center gap-1 text-primary font-medium">
          <Crown className="h-3 w-3" />
          {plan}
        </span>

        <span className="text-border">|</span>

        {/* 5h 블록 */}
        <span className="flex items-center gap-1">
          <span className="text-muted-foreground/60">5h:</span>
          <span className={cn(block_5h.is_active ? 'text-foreground' : 'text-muted-foreground')}>
            ${block_5h.cost_usd.toFixed(2)}
          </span>
          <span className="text-muted-foreground/60">
            ({formatTokens(block_5h.total_tokens)})
          </span>
        </span>

        <span className="text-border">|</span>

        {/* 주간 */}
        <span className="flex items-center gap-1">
          <span className="text-muted-foreground/60">wk:</span>
          <span>${weekly.cost_usd.toFixed(2)}</span>
          <span className="text-muted-foreground/60">
            ({formatTokens(weekly.total_tokens)})
          </span>
        </span>
      </div>

      {/* 우측: 활성 블록 정보 */}
      {block_5h.is_active ? (
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-info" />
            <span className="text-info">{block_5h.time_remaining}</span>
          </span>
          <span className="flex items-center gap-1">
            <Flame className="h-3 w-3 text-warning" />
            <span className="text-warning">{formatTokens(block_5h.burn_rate)}/h</span>
          </span>
        </div>
      ) : null}
    </footer>
  );
}
