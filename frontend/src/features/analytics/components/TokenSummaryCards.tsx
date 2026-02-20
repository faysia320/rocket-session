import { memo } from "react";
import { Zap, ArrowUpRight, ArrowDownLeft, Hash } from "lucide-react";
import { formatTokens } from "@/lib/utils";
import type { TokenSummary } from "@/types";

interface TokenSummaryCardsProps {
  summary: TokenSummary;
}

const cards = [
  {
    label: "총 토큰",
    icon: Zap,
    iconClass: "text-primary",
    getValue: (s: TokenSummary) => s.total_input_tokens + s.total_output_tokens,
  },
  {
    label: "Input",
    icon: ArrowDownLeft,
    iconClass: "text-info",
    getValue: (s: TokenSummary) => s.total_input_tokens,
  },
  {
    label: "Output",
    icon: ArrowUpRight,
    iconClass: "text-primary",
    getValue: (s: TokenSummary) => s.total_output_tokens,
  },
  {
    label: "세션 수",
    icon: Hash,
    iconClass: "text-success",
    getValue: (s: TokenSummary) => s.total_sessions,
    raw: true,
  },
] as const;

export const TokenSummaryCards = memo(function TokenSummaryCards({
  summary,
}: TokenSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => {
        const value = card.getValue(summary);
        return (
          <div
            key={card.label}
            className="rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <card.icon className={`h-3.5 w-3.5 ${card.iconClass}`} />
              <span className="font-mono text-2xs text-muted-foreground">
                {card.label}
              </span>
            </div>
            <p className="font-mono text-lg font-semibold text-foreground">
              {"raw" in card ? String(value) : formatTokens(value)}
            </p>
          </div>
        );
      })}
    </div>
  );
});
