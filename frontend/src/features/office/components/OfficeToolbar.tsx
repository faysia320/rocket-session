import { memo, useCallback } from "react";
import { ZoomIn, ZoomOut, Maximize2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useOfficeStore } from "../hooks/useOfficeStore";

export const OfficeToolbar = memo(function OfficeToolbar() {
  const zoom = useOfficeStore((s) => s.zoom);
  const showLabels = useOfficeStore((s) => s.showLabels);
  const adjustZoom = useOfficeStore((s) => s.adjustZoom);
  const setZoom = useOfficeStore((s) => s.setZoom);
  const toggleLabels = useOfficeStore((s) => s.toggleLabels);

  const handleZoomIn = useCallback(() => adjustZoom(1), [adjustZoom]);
  const handleZoomOut = useCallback(() => adjustZoom(-1), [adjustZoom]);
  const handleFit = useCallback(() => setZoom(3), [setZoom]);

  return (
    <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-1.5 py-1 shadow-md">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleZoomOut}
            disabled={zoom <= 1}
            aria-label="축소"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">축소</TooltipContent>
      </Tooltip>

      <span className="font-mono text-2xs text-muted-foreground w-6 text-center select-none">
        {zoom}x
      </span>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleZoomIn}
            disabled={zoom >= 5}
            aria-label="확대"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">확대</TooltipContent>
      </Tooltip>

      <div className="w-px h-4 bg-border mx-0.5" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleFit}
            aria-label="기본 크기"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">기본 크기</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", showLabels && "text-primary")}
            onClick={toggleLabels}
            aria-label={showLabels ? "이름표 숨기기" : "이름표 보이기"}
          >
            <Tag className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {showLabels ? "이름표 숨기기" : "이름표 보이기"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
});
