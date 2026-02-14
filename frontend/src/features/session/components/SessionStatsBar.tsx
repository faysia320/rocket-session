import { memo } from 'react';
import { DollarSign, Zap, Clock } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useSessionStats } from '../hooks/useSessionStats';
import { ContextWindowBar } from '@/features/chat/components/ContextWindowBar';

interface SessionStatsBarProps {
  sessionId: string;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  };
  messageCount?: number;
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  return `${minutes}m ${remainSeconds}s`;
}

export const SessionStatsBar = memo(function SessionStatsBar({ sessionId, tokenUsage, messageCount }: SessionStatsBarProps) {
  const { data: stats } = useSessionStats(sessionId);

  if (!stats || stats.total_messages === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-1 border-b border-border bg-card/50">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-default">
            <DollarSign className="h-3 w-3 text-primary/70" />
            <span className={cn(
              'font-mono text-[10px]',
              stats.total_cost > 1 ? 'text-warning font-semibold' : 'text-muted-foreground',
            )}>
              {formatCost(stats.total_cost)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="font-mono text-xs">
          누적 비용: {formatCost(stats.total_cost)}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-default">
            <Zap className="h-3 w-3 text-info/70" />
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatTokens(stats.total_input_tokens + stats.total_output_tokens)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="font-mono text-xs">
          <div className="space-y-0.5">
            <div>Input: {formatTokens(stats.total_input_tokens)}</div>
            <div>Output: {formatTokens(stats.total_output_tokens)}</div>
            {stats.total_cache_read_tokens > 0 ? (
              <div>Cache Read: {formatTokens(stats.total_cache_read_tokens)}</div>
            ) : null}
            {stats.total_cache_creation_tokens > 0 ? (
              <div>Cache Write: {formatTokens(stats.total_cache_creation_tokens)}</div>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-default">
            <Clock className="h-3 w-3 text-muted-foreground/70" />
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatDuration(stats.total_duration_ms)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="font-mono text-xs">
          총 실행 시간: {formatDuration(stats.total_duration_ms)}
        </TooltipContent>
      </Tooltip>

      <span className="font-mono text-[10px] text-muted-foreground/50">
        {stats.total_messages} msgs
      </span>

      {tokenUsage ? (
        <div className="ml-auto">
          <ContextWindowBar
            inputTokens={tokenUsage.inputTokens}
            outputTokens={tokenUsage.outputTokens}
            cacheCreationTokens={tokenUsage.cacheCreationTokens}
            cacheReadTokens={tokenUsage.cacheReadTokens}
            messageCount={messageCount}
          />
        </div>
      ) : null}
    </div>
  );
});
