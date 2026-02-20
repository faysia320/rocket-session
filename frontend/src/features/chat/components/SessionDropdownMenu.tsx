import { memo, useCallback } from "react";
import { EllipsisVertical, Download, Settings, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sessionsApi } from "@/lib/api/sessions.api";

interface SessionDropdownMenuProps {
  sessionId: string;
  isArchived?: boolean;
  onOpenSettings: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
}

export const SessionDropdownMenu = memo(function SessionDropdownMenu({
  sessionId,
  isArchived,
  onOpenSettings,
  onArchive,
  onUnarchive,
}: SessionDropdownMenuProps) {
  const handleExport = useCallback(() => {
    sessionsApi.exportMarkdown(sessionId);
  }, [sessionId]);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="세션 메뉴"
            >
              <EllipsisVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>세션 메뉴</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-44">
        {isArchived ? (
          <DropdownMenuItem
            onClick={onUnarchive}
            className="font-mono text-xs gap-2"
          >
            <ArchiveRestore className="h-3.5 w-3.5" />
            보관 해제
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={onArchive}
            className="font-mono text-xs gap-2"
          >
            <Archive className="h-3.5 w-3.5" />
            보관하기
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleExport}
          className="font-mono text-xs gap-2"
        >
          <Download className="h-3.5 w-3.5" />
          대화 내보내기
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            setTimeout(() => onOpenSettings(), 0);
          }}
          className="font-mono text-xs gap-2"
        >
          <Settings className="h-3.5 w-3.5" />
          세션 설정
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
