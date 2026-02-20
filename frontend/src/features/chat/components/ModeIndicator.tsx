import { ClipboardList } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { SessionMode } from "@/types";

interface ModeIndicatorProps {
  mode: SessionMode;
  onToggle: () => void;
}

export function ModeIndicator({ mode, onToggle }: ModeIndicatorProps) {
  if (mode !== "plan") return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-all duration-200 cursor-pointer"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Plan Mode
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        </button>
      </TooltipTrigger>
      <TooltipContent>Plan Mode (Shift+Tab)</TooltipContent>
    </Tooltip>
  );
}
