import { memo, useCallback, useState } from "react";
import { EllipsisVertical, Download, Settings, Archive, ArchiveRestore, Trash2, GitFork } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { sessionsApi } from "@/lib/api/sessions.api";

interface SessionDropdownMenuProps {
  sessionId: string;
  isArchived?: boolean;
  onOpenSettings: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete?: () => void;
  onFork?: () => void;
}

export const SessionDropdownMenu = memo(function SessionDropdownMenu({
  sessionId,
  isArchived,
  onOpenSettings,
  onArchive,
  onUnarchive,
  onDelete,
  onFork,
}: SessionDropdownMenuProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const handleExport = useCallback(() => {
    sessionsApi.exportMarkdown(sessionId);
  }, [sessionId]);

  return (
    <>
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
        <DropdownMenuItem
          onClick={() => setDeleteConfirmOpen(true)}
          className="font-mono text-xs gap-2 text-destructive focus:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          삭제하기
        </DropdownMenuItem>
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
        <DropdownMenuItem
          onClick={onFork}
          className="font-mono text-xs gap-2"
        >
          <GitFork className="h-3.5 w-3.5" />
          세션 포크
        </DropdownMenuItem>
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
    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-mono text-sm">
            세션을 삭제하시겠습니까?
          </AlertDialogTitle>
          <AlertDialogDescription className="font-mono text-xs">
            이 세션의 모든 대화 기록과 파일 변경 이력이 영구적으로 삭제됩니다.
            이 작업은 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="font-mono text-xs">취소</AlertDialogCancel>
          <AlertDialogAction
            className="font-mono text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onDelete}
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
});
