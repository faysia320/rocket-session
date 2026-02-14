import { AlertCircle, Clock } from "lucide-react";
import { useUsage } from "../hooks/useUsage";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

function formatTimeRemaining(resetsAt: string | null): string {
  if (!resetsAt) return "--:--";
  const now = Date.now();
  const reset = new Date(resetsAt).getTime();
  const diffMs = reset - now;
  if (diffMs <= 0) return "00:00";
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function utilizationColor(util: number): string {
  if (util >= 80) return "text-destructive";
  if (util >= 50) return "text-warning";
  return "text-success";
}

export function UsageFooter() {
  const { data, isLoading, isError } = useUsage();

  const fiveHourCountdown = useMemo(
    () => formatTimeRemaining(data?.five_hour?.resets_at ?? null),
    [data?.five_hour?.resets_at],
  );

  const sevenDayCountdown = useMemo(
    () => formatTimeRemaining(data?.seven_day?.resets_at ?? null),
    [data?.seven_day?.resets_at],
  );

  if (isLoading) {
    return (
      <footer className="h-8 shrink-0 border-t border-sidebar-border bg-sidebar flex items-center justify-between px-3">
        <span className="font-mono text-[11px] font-semibold text-primary">
          Rocket Session
        </span>
        <div className="h-3 w-48 animate-pulse rounded bg-muted" />
      </footer>
    );
  }

  if (isError || !data || !data.available) {
    return (
      <footer className="h-8 shrink-0 border-t border-sidebar-border bg-sidebar flex items-center justify-between px-3 text-xs text-muted-foreground">
        <span className="font-mono text-[11px] font-semibold text-primary">
          Rocket Session
        </span>
        <span className="flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3" />
          <span>
            {data?.error ? data.error : "사용량 정보를 가져올 수 없습니다"}
          </span>
        </span>
      </footer>
    );
  }

  const { five_hour, seven_day } = data;

  return (
    <footer className="h-8 shrink-0 border-t border-sidebar-border bg-sidebar flex items-center justify-between px-3 text-xs text-muted-foreground">
      {/* 좌측: 브랜드 + 5h utilization */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-semibold text-primary">
          Rocket Session
        </span>

        <span className="text-border hidden sm:inline">|</span>

        <span className="items-center gap-1 hidden sm:flex">
          <span className="text-muted-foreground/60">5h:</span>
          <span className={cn("font-medium", utilizationColor(five_hour.utilization))}>
            {five_hour.utilization.toFixed(0)}%
          </span>
        </span>

        <span className="items-center gap-1 hidden sm:flex text-muted-foreground/60">
          <Clock className="h-3 w-3" />
          {fiveHourCountdown}
        </span>
      </div>

      {/* 우측: wk utilization */}
      <div className="items-center gap-2 hidden md:flex">
        <span className="flex items-center gap-1">
          <span className="text-muted-foreground/60">wk:</span>
          <span className={cn("font-medium", utilizationColor(seven_day.utilization))}>
            {seven_day.utilization.toFixed(0)}%
          </span>
        </span>

        <span className="flex items-center gap-1 text-muted-foreground/60">
          <Clock className="h-3 w-3" />
          {sevenDayCountdown}
        </span>
      </div>
    </footer>
  );
}
