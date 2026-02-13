import { Crown, AlertCircle, Clock, Flame } from 'lucide-react';
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
      <footer className="h-8 shrink-0 border-t border-sidebar-border bg-sidebar flex items-center justify-between px-3">
        <span className="font-mono text-[11px] font-semibold text-primary">Rocket Session</span>
        <div className="h-3 w-48 animate-pulse rounded bg-muted" />
      </footer>
    );
  }

  if (isError || !data || !data.available) {
    return (
      <footer className="h-8 shrink-0 border-t border-sidebar-border bg-sidebar flex items-center justify-between px-3 text-xs text-muted-foreground">
        <span className="font-mono text-[11px] font-semibold text-primary">Rocket Session</span>
        <span className="flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3" />
          <span>{data?.error ? data.error : '사용량 정보를 가져올 수 없습니다'}</span>
        </span>
      </footer>
    );
  }

  const { plan, account_id, block_5h, weekly } = data;

  return (
    <footer className="h-8 shrink-0 border-t border-sidebar-border bg-sidebar flex items-center justify-between px-3 text-xs text-muted-foreground">
      {/* 좌측: 브랜드 + 활성 블록 정보 */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-semibold text-primary">Rocket Session</span>

        <span className="text-border">|</span>

        <span className={cn(
          'flex items-center gap-1',
          block_5h.is_active ? 'text-info' : 'text-muted-foreground/40',
        )}>
          <Clock className="h-3 w-3" />
          {block_5h.is_active && block_5h.time_remaining
            ? block_5h.time_remaining
            : '--:--'}
        </span>

        <span className="text-border">|</span>

        <span className={cn(
          'flex items-center gap-1',
          block_5h.is_active ? 'text-warning' : 'text-muted-foreground/40',
        )}>
          <Flame className="h-3 w-3" />
          {block_5h.is_active && block_5h.burn_rate > 0
            ? `$${block_5h.burn_rate}/h`
            : '-'}
        </span>
      </div>

      {/* 우측: 계정 ID + 플랜 + 5h + wk */}
      <div className="flex items-center gap-3">
        {account_id ? (
          <>
            <span className="text-muted-foreground/70 truncate max-w-[150px]" title={account_id}>
              {account_id}
            </span>
            <span className="text-border">|</span>
          </>
        ) : null}

        <span className="flex items-center gap-1 text-primary font-medium">
          <Crown className="h-3 w-3" />
          {plan}
        </span>

        <span className="text-border">|</span>

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

        <span className="flex items-center gap-1">
          <span className="text-muted-foreground/60">wk:</span>
          <span>${weekly.cost_usd.toFixed(2)}</span>
          <span className="text-muted-foreground/60">
            ({formatTokens(weekly.total_tokens)})
          </span>
        </span>
      </div>
    </footer>
  );
}
