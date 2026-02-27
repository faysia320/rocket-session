import { memo } from "react";
import { Zap, ArrowUpRight, ArrowDownLeft, Hash } from "lucide-react";
import { formatTokens, cn } from "@/lib/utils";
import type { TokenSummary } from "@/types";

interface TokenSummaryCardsProps {
  summary: TokenSummary;
}

const cards = [
  {
    label: "총 토큰",
    icon: Zap,
    iconClass: "text-primary",
    borderClass: "border-t-primary",
    getValue: (s: TokenSummary) => s.total_input_tokens + s.total_output_tokens,
  },
  {
    label: "Input",
    icon: ArrowDownLeft,
    iconClass: "text-info",
    borderClass: "border-t-info",
    getValue: (s: TokenSummary) => s.total_input_tokens,
  },
  {
    label: "Output",
    icon: ArrowUpRight,
    iconClass: "text-primary",
    borderClass: "border-t-primary",
    getValue: (s: TokenSummary) => s.total_output_tokens,
  },
  {
    label: "세션 수",
    icon: Hash,
    iconClass: "text-success",
    borderClass: "border-t-success",
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
            className={cn(
              "rounded-lg border border-border bg-card p-3",
              "shadow-card hover:shadow-card-hover transition-shadow",
              "border-t-2",
              card.borderClass,
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <card.icon className={`h-4 w-4 ${card.iconClass}`} />
              <span className="font-mono text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className="font-mono text-xl font-semibold text-foreground [font-variant-numeric:tabular-nums]">
              {"raw" in card ? String(value) : formatTokens(value)}
            </p>
          </div>
        );
      })}
    </div>
  );
});
