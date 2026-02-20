/**
 * 태그 배지 목록 컴포넌트.
 * max 개수 초과 시 "+N" 표시.
 */
import { cn } from "@/lib/utils";
import { TagBadge } from "./TagBadge";
import type { TagInfo } from "@/types";

interface TagBadgeListProps {
  tags: TagInfo[];
  max?: number;
  size?: "sm" | "md";
  onRemove?: (tagId: string) => void;
  className?: string;
}

export function TagBadgeList({
  tags,
  max = 3,
  size = "sm",
  onRemove,
  className,
}: TagBadgeListProps) {
  if (tags.length === 0) return null;

  const visible = tags.slice(0, max);
  const remaining = tags.length - max;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visible.map((tag) => (
        <TagBadge
          key={tag.id}
          name={tag.name}
          color={tag.color}
          size={size}
          onRemove={onRemove ? () => onRemove(tag.id) : undefined}
        />
      ))}
      {remaining > 0 ? (
        <span className="text-xs text-muted-foreground">+{remaining}</span>
      ) : null}
    </div>
  );
}
