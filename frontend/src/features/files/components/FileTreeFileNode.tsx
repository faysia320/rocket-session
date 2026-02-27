import { memo, useCallback, useRef } from "react";
import { FileCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { DiffHoverContent } from "./DiffHoverContent";
import { cn, formatTime } from "@/lib/utils";
import { getToolBadgeStyle } from "../constants/toolColors";
import { useDiffFetch } from "../hooks/useDiffFetch";
import type { FileTreeNodeComponentProps } from "./types";

export const FileTreeFileNode = memo(function FileTreeFileNode({
  node,
  depth,
  sessionId,
  onFullView,
  openHoverFile,
  onHoverOpenChange,
  isMobile,
}: FileTreeNodeComponentProps) {
  const item = node.fileChange!;
  const { diff, loading, fetchIfNeeded } = useDiffFetch(sessionId, item.file);
  const isHoverOpen = openHoverFile === item.file;
  const openSourceRef = useRef<"hover" | "click" | null>(null);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen && openSourceRef.current === "click") {
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
          className="w-full flex items-center gap-1.5 py-1 px-1.5 rounded-sm hover:bg-muted/50 transition-colors cursor-pointer"
          style={{ paddingLeft: depth * 16 + 8 }}
          aria-label={`파일 보기: ${node.name}`}
        >
          <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="font-mono text-xs text-primary truncate">{node.name}</span>
          {item.tools.map((tool) => (
            <Badge
              key={tool}
              variant="outline"
              className="font-mono text-2xs shrink-0"
              style={getToolBadgeStyle(tool)}
            >
              {tool}
            </Badge>
          ))}
          {item.count > 1 ? (
            <Badge
              variant="secondary"
              className="font-mono text-2xs shrink-0"
            >{`\u00D7${item.count}`}</Badge>
          ) : null}
          <span className="font-mono text-2xs text-muted-foreground/70 ml-auto shrink-0">
            {item.lastTimestamp ? formatTime(item.lastTimestamp) : null}
          </span>
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
          fileName={node.name}
          onFullView={onFullView ? handleFullView : undefined}
        />
      </HoverCardContent>
    </HoverCard>
  );
});
