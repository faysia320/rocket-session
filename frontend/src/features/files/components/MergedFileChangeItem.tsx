import { memo, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { DiffHoverContent } from "./DiffHoverContent";
import { cn, formatTime } from "@/lib/utils";
import { getToolBadgeStyle } from "../constants/toolColors";
import { useDiffFetch } from "../hooks/useDiffFetch";
import { shortenFilePath } from "./fileTreeUtils";
import type { MergedFileChange } from "./types";
import type { FileChange } from "@/types";

interface MergedFileChangeItemProps {
  sessionId: string;
  item: MergedFileChange;
  onFullView?: (change: FileChange) => void;
  isHoverOpen: boolean;
  onHoverOpenChange: (file: string | null) => void;
  isMobile: boolean;
}

export const MergedFileChangeItem = memo(function MergedFileChangeItem({
  sessionId,
  item,
  onFullView,
  isHoverOpen,
  onHoverOpenChange,
  isMobile,
}: MergedFileChangeItemProps) {
  const { diff, loading, fetchIfNeeded } = useDiffFetch(sessionId, item.file);
  const openSourceRef = useRef<"hover" | "click" | null>(null);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen && openSourceRef.current === "click") {
        // click으로 열린 경우 hover-leave로 닫히지 않도록 방지
        return;
      }
      onHoverOpenChange(isOpen ? item.file : null);
      if (isOpen) {
        openSourceRef.current = "hover";
        fetchIfNeeded();
      } else {
        openSourceRef.current = null;
      }
    },
    [fetchIfNeeded, onHoverOpenChange, item.file],
  );

  const handleFullView = useCallback(() => {
    onHoverOpenChange(null);
    openSourceRef.current = null;
    onFullView?.(item.latest);
  }, [onFullView, item.latest, onHoverOpenChange]);

  const handleClick = useCallback(() => {
    if (isHoverOpen && openSourceRef.current === "click") {
      // 클릭으로 열린 상태에서 다시 클릭하면 닫기
      onHoverOpenChange(null);
      openSourceRef.current = null;
    } else {
      onHoverOpenChange(item.file);
      openSourceRef.current = "click";
      fetchIfNeeded();
    }
  }, [isHoverOpen, fetchIfNeeded, onHoverOpenChange, item.file]);

  return (
    <HoverCard open={isHoverOpen} onOpenChange={handleOpenChange} openDelay={300} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          className="w-full text-left p-2 px-2.5 bg-secondary border border-border rounded-sm animate-[fadeIn_0.2s_ease] hover:border-primary/30 hover:bg-secondary/80 transition-colors cursor-pointer mb-1.5"
          aria-label={`파일 보기: ${item.file}`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            {item.tools.map((tool) => (
              <Badge
                key={tool}
                variant="outline"
                className="font-mono text-2xs"
                style={getToolBadgeStyle(tool)}
              >
                {tool}
              </Badge>
            ))}
            {item.count > 1 ? (
              <Badge variant="secondary" className="font-mono text-2xs">
                {`\u00D7${item.count}`}
              </Badge>
            ) : null}
            <span className="font-mono text-2xs text-muted-foreground/70 ml-auto shrink-0">
              {item.lastTimestamp ? formatTime(item.lastTimestamp) : null}
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="font-mono text-xs text-primary break-all pl-1">
                {shortenFilePath(item.file)}
              </div>
            </TooltipTrigger>
            <TooltipContent className="font-mono text-xs">{item.file}</TooltipContent>
          </Tooltip>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side={isMobile ? "bottom" : "left"}
        align="start"
        sideOffset={8}
        className={cn(
          "overflow-hidden p-0 flex flex-col",
          isMobile ? "w-[calc(100vw-2rem)] max-h-[300px]" : "w-[720px] max-h-[450px]",
        )}
      >
        <DiffHoverContent
          diff={diff}
          loading={loading}
          fileName={item.file.split(/[/\\]/).pop()}
          onFullView={onFullView ? handleFullView : undefined}
        />
      </HoverCardContent>
    </HoverCard>
  );
});
