import { memo, useCallback } from "react";
import { EllipsisVertical, Download, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sessionsApi } from "@/lib/api/sessions.api";

interface SessionDropdownMenuProps {
  sessionId: string;
  onOpenSettings: () => void;
}

export const SessionDropdownMenu = memo(function SessionDropdownMenu({
  sessionId,
  onOpenSettings,
}: SessionDropdownMenuProps) {
  const handleExport = useCallback(() => {
    sessionsApi.exportMarkdown(sessionId);
  }, [sessionId]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="세션 메뉴"
          title="세션 메뉴"
        >
          <EllipsisVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
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
