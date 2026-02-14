import { memo, useMemo } from "react";
import { Terminal, MessageSquare, FileText, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SessionInfo } from "@/types";

interface SessionDashboardCardProps {
  session: SessionInfo;
  isActive: boolean;
  onSelect: (id: string) => void;
  onOpenTerminal?: (id: string) => void;
  lastEventTime?: number | null;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

function truncatePath(p: string): string {
  if (!p) return "~";
  const parts = p.split(/[/\\]/);
  if (parts.length <= 3) return p;
  return "~/" + parts.slice(-2).join("/");
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000;

export const SessionDashboardCard = memo(function SessionDashboardCard({
  session: s,
  isActive,
  onSelect,
  onOpenTerminal,
  lastEventTime,
}: SessionDashboardCardProps) {
  const isStale = useMemo(() => {
    if (s.status !== "running") return false;
    if (!lastEventTime) return false;
    return Date.now() - lastEventTime > STALE_THRESHOLD_MS;
  }, [s.status, lastEventTime]);

  const statusColor =
    s.status === "running"
      ? isStale
        ? "bg-warning"
        : "bg-success"
      : s.status === "error"
        ? "bg-destructive"
        : "bg-muted-foreground";

  const statusLabel =
    s.status === "running"
      ? isStale
        ? "Stale"
        : "Running"
      : s.status === "error"
        ? "Error"
        : s.status === "stopped"
          ? "Stopped"
          : "Idle";

  return (
    <Card
      className={cn(
        "relative p-4 cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-md group",
        isActive && "border-primary/60 shadow-md",
        s.status === "running" &&
          !isStale &&
          "border-success/30 shadow-[0_0_12px_hsl(var(--success)/0.1)]",
        isStale && "opacity-70",
      )}
      onClick={() => onSelect(s.id)}
    >
      {/* 헤더: 상태 + 이름 */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            statusColor,
            s.status === "running" && !isStale && "animate-pulse",
          )}
        />
        <span
          className="font-mono text-sm font-semibold text-foreground truncate flex-1"
          title={s.name || s.id}
        >
          {s.name || s.id}
        </span>
        <span
          className={cn(
            "font-mono text-[10px] px-1.5 py-0.5 rounded-sm border",
            s.status === "running" &&
              !isStale &&
              "bg-success/10 text-success border-success/20",
            s.status === "running" &&
              isStale &&
              "bg-warning/10 text-warning border-warning/20",
            s.status === "error" &&
              "bg-destructive/10 text-destructive border-destructive/20",
            s.status !== "running" &&
              s.status !== "error" &&
              "bg-muted text-muted-foreground border-border",
          )}
        >
          {statusLabel}
        </span>
      </div>

      {/* 통계 행 */}
      <div className="flex items-center gap-3 mb-2 text-muted-foreground">
        <div className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          <span className="font-mono text-[11px]">{s.message_count}</span>
        </div>
        <div className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          <span className="font-mono text-[11px]">{s.file_changes_count}</span>
        </div>
        {s.created_at ? (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span className="font-mono text-[10px]">
              {formatRelativeTime(s.created_at)}
            </span>
          </div>
        ) : null}
      </div>

      {/* work_dir */}
      <div
        className="font-mono text-[10px] text-muted-foreground/60 truncate mb-2"
        title={s.work_dir}
      >
        {truncatePath(s.work_dir)}
      </div>

      {/* 모델 표시 */}
      {s.model ? (
        <span className="font-mono text-[10px] text-info/70">{s.model}</span>
      ) : null}

      {/* 터미널 열기 버튼 */}
      {onOpenTerminal ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute bottom-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onOpenTerminal(s.id);
              }}
              aria-label="터미널에서 열기"
            >
              <Terminal className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">터미널에서 열기</TooltipContent>
        </Tooltip>
      ) : null}
    </Card>
  );
});
