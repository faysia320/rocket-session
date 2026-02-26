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
        "rounded-lg border border-border bg-card p-4",
        "shadow-sm hover:shadow-md transition-shadow",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-mono text-sm font-semibold text-foreground">
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
