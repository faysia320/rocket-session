import { memo, useState, useCallback } from "react";
import { Archive, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { WorkspaceInsightInfo, InsightCategory } from "@/types/knowledge";

const CATEGORY_CONFIG: Record<InsightCategory, { label: string; color: string }> = {
  pattern: { label: "Pattern", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  gotcha: { label: "Gotcha", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  decision: { label: "Decision", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  file_map: { label: "File Map", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  dependency: {
    label: "Dependency",
    color: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  },
};

interface InsightCardProps {
  insight: WorkspaceInsightInfo;
  onEdit?: (insight: WorkspaceInsightInfo) => void;
  onArchive?: (id: number) => void;
  onDelete?: (id: number) => void;
}

export const InsightCard = memo(function InsightCard({
  insight,
  onEdit,
  onArchive,
  onDelete,
}: InsightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = CATEGORY_CONFIG[insight.category] ?? CATEGORY_CONFIG.pattern;

  const toggleExpand = useCallback(() => setExpanded((v) => !v), []);

  return (
    <div
      className={cn(
        "border border-border rounded-md p-3 transition-colors hover:border-border-bright",
        insight.is_archived && "opacity-50",
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <Badge variant="outline" className={cn("font-mono text-2xs shrink-0 border", config.color)}>
          {config.label}
        </Badge>
        <button
          type="button"
          className="flex-1 text-left font-mono text-sm font-medium text-foreground cursor-pointer hover:text-primary transition-colors"
          onClick={toggleExpand}
        >
          {insight.title}
        </button>
        {insight.is_auto_generated && (
          <Badge variant="secondary" className="font-mono text-2xs shrink-0">
            Auto
          </Badge>
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          "font-mono text-xs text-muted-foreground whitespace-pre-wrap",
          !expanded && "line-clamp-2",
        )}
      >
        {insight.content}
      </div>

      {/* Tags */}
      {insight.tags && insight.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {insight.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="font-mono text-2xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* File paths */}
      {insight.file_paths && insight.file_paths.length > 0 && expanded && (
        <div className="mt-2 space-y-0.5">
          {insight.file_paths.map((fp) => (
            <div key={fp} className="font-mono text-2xs text-muted-foreground/70 truncate">
              {fp}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
        <span className="font-mono text-2xs text-muted-foreground/50 flex-1">
          {new Date(insight.created_at).toLocaleDateString()}
        </span>
        {onEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 touch-target-expand"
                onClick={() => onEdit(insight)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
        )}
        {onArchive && !insight.is_archived && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 touch-target-expand"
                onClick={() => onArchive(insight.id)}
              >
                <Archive className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>
        )}
        {onDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive/70 hover:text-destructive touch-target-expand"
                onClick={() => onDelete(insight.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
});
