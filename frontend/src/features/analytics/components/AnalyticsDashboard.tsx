import { memo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAnalytics } from "../hooks/useAnalytics";
import { TokenSummaryCards } from "./TokenSummaryCards";
import { DailyTokenChart } from "./DailyTokenChart";
import { SessionRankingTable } from "./SessionRankingTable";
import { ProjectBreakdown } from "./ProjectBreakdown";
import { PhaseTokenBreakdown } from "./PhaseTokenBreakdown";
import { SessionPhaseChart } from "./SessionPhaseChart";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AnalyticsPeriod } from "@/types";

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "today", label: "오늘" },
  { value: "7d", label: "7일" },
  { value: "30d", label: "30일" },
  { value: "all", label: "전체" },
];

export const AnalyticsDashboard = memo(function AnalyticsDashboard() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("7d");
  const { data, isLoading, isError } = useAnalytics(period);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ScrollArea className="flex-1">
      <div className="p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-mono text-lg font-semibold text-foreground">Token Analytics</h1>
            <p className="font-mono text-xs text-muted-foreground">토큰 사용량 분석</p>
          </div>
          {/* 기간 선택 탭 */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  "font-mono text-xs px-3 py-1 rounded-md transition-colors",
                  period === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
                onClick={() => setPeriod(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 로딩 */}
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isError || !data ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground font-mono text-xs">
            데이터를 불러올 수 없습니다
          </div>
        ) : (
          <div className="space-y-5">
            {/* 요약 카드 */}
            <TokenSummaryCards summary={data.summary} />

            {/* Phase별 토큰 사용량 */}
            <PhaseTokenBreakdown data={data.phase_usage} />

            {/* 세션별 Phase 토큰 분포 */}
            <SessionPhaseChart data={data.session_phase_usage} />

            {/* 일별 추이 차트 */}
            <DailyTokenChart data={data.daily_usage} />

            {/* 하단 2열: 세션 랭킹 + 프로젝트별 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <SessionRankingTable data={data.session_ranking} />
              <ProjectBreakdown data={data.project_usage} />
            </div>
          </div>
        )}
      </div>
      </ScrollArea>
    </div>
  );
});
