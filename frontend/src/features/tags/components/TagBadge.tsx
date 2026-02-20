/**
 * 단일 태그 배지 컴포넌트.
 * 태그 색상을 배경(15% 투명도) + 텍스트 색상으로 표시.
 */
import { cn } from "@/lib/utils";

interface TagBadgeProps {
  name: string;
  color: string;
  size?: "sm" | "md";
  onRemove?: () => void;
  className?: string;
}

export function TagBadge({
  name,
  color,
  size = "sm",
  onRemove,
  className,
}: TagBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        className,
      )}
      style={{
        backgroundColor: `${color}26`,
        color,
      }}
    >
      {name}
      {onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-white/20"
          aria-label={`${name} 태그 제거`}
        >
          <svg
            width={size === "sm" ? 10 : 12}
            height={size === "sm" ? 10 : 12}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      ) : null}
    </span>
  );
}
