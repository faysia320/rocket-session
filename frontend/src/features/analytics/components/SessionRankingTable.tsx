import { memo, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { formatTokens, truncatePath } from "@/lib/utils";
import { useSessionStore } from "@/store";
import type { SessionTokenRanking } from "@/types";

interface SessionRankingTableProps {
  data: SessionTokenRanking[];
}

function formatModelName(model: string | null): string {
  if (!model) return "";
  const lower = model.toLowerCase();
  if (lower.includes("opus")) return "Opus";
  if (lower.includes("sonnet")) return "Sonnet";
  if (lower.includes("haiku")) return "Haiku";
  return model.split("-").pop() ?? model;
}

export const SessionRankingTable = memo(function SessionRankingTable({
  data,
}: SessionRankingTableProps) {
  const navigate = useNavigate();
  const setCostView = useSessionStore((s) => s.setCostView);

  const handleClick = useCallback(
    (sessionId: string) => {
      setCostView(false);
      navigate({ to: "/session/$sessionId", params: { sessionId } });
    },
    [navigate, setCostView],
  );

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-mono text-xs font-medium text-foreground mb-3">
          세션별 토큰 랭킹
        </h3>
        <div className="flex items-center justify-center h-[120px] text-muted-foreground text-xs font-mono">
          데이터가 없습니다
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 overflow-hidden">
      <h3 className="font-mono text-xs font-medium text-foreground mb-3">
        세션별 토큰 랭킹
      </h3>
      <div className="overflow-auto max-h-[280px]">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-2xs text-muted-foreground font-mono">
              <th className="pb-2 pr-2">#</th>
              <th className="pb-2 pr-2">세션</th>
              <th className="pb-2 pr-2 text-right">토큰</th>
              <th className="pb-2 pr-2 text-right hidden sm:table-cell">
                메시지
              </th>
              <th className="pb-2 text-right hidden sm:table-cell">모델</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={row.session_id}
                className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => handleClick(row.session_id)}
              >
                <td className="py-1.5 pr-2 font-mono text-2xs text-muted-foreground">
                  {i + 1}
                </td>
                <td className="py-1.5 pr-2">
                  <div className="font-mono text-xs text-foreground truncate max-w-[180px]">
                    {row.session_name ?? truncatePath(row.work_dir, 30)}
                  </div>
                </td>
                <td className="py-1.5 pr-2 text-right font-mono text-xs text-foreground">
                  {formatTokens(row.total_tokens)}
                </td>
                <td className="py-1.5 pr-2 text-right font-mono text-2xs text-muted-foreground hidden sm:table-cell">
                  {row.message_count}
                </td>
                <td className="py-1.5 text-right hidden sm:table-cell">
                  {row.model ? (
                    <span className="font-mono text-2xs px-1.5 py-0.5 rounded bg-info/10 text-info border border-info/20">
                      {formatModelName(row.model)}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
