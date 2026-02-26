import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  emptyMessage?: string;
  isEmpty?: boolean;
}

export const ChartCard = memo(function ChartCard({
  title,
  subtitle,
  action,
  children,
  className,
  emptyMessage = "데이터가 없습니다",
  isEmpty = false,
}: ChartCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[hsl(var(--border-bright)/0.4)] p-4",
        "bg-gradient-to-br from-card to-card/80",
        "shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]",
        "ring-1 ring-white/5 dark:ring-white/[0.03]",
        "backdrop-blur-sm",
        "transition-all duration-200",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-mono text-sm font-semibold text-foreground/90">
            {title}
          </h3>
          {subtitle && (
            <p className="font-mono text-2xs text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      {isEmpty ? (
        <div className="flex items-center justify-center h-[140px] text-muted-foreground text-xs font-mono">
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </div>
  );
});
