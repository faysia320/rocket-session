import { memo, useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useUpdateWorkspace } from "../hooks/useWorkspaces";
import { ValidationCommandEditor } from "./ValidationCommandEditor";
import type { WorkspaceInfo, ValidationCommand } from "@/types/workspace";

interface WorkspaceSettingsSheetProps {
  workspace: WorkspaceInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WorkspaceSettingsSheet = memo(function WorkspaceSettingsSheet({
  workspace,
  open,
  onOpenChange,
}: WorkspaceSettingsSheetProps) {
  "use memo";
  const updateMutation = useUpdateWorkspace();
  const [name, setName] = useState("");
  const [commands, setCommands] = useState<ValidationCommand[]>([]);

  // 시트 열릴 때 워크스페이스 데이터 로드
  useEffect(() => {
    if (open && workspace) {
      setName(workspace.name);
      setCommands(workspace.validation_commands ?? []);
    }
  }, [open, workspace]);

  const handleSave = useCallback(async () => {
    if (!workspace) return;
    try {
      // 빈 이름/명령어를 가진 항목 필터링
      const validCommands = commands.filter(
        (c) => c.name.trim() && c.command.trim(),
      );
      await updateMutation.mutateAsync({
        id: workspace.id,
        data: {
          name: name.trim() || workspace.name,
          validation_commands: validCommands.length > 0 ? validCommands : null,
        },
      });
      toast.success("워크스페이스 설정이 저장되었습니다");
      onOpenChange(false);
    } catch {
      toast.error("설정 저장에 실패했습니다");
    }
  }, [workspace, name, commands, updateMutation, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b border-border">
          <SheetTitle className="font-mono text-sm">워크스페이스 설정</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* 기본 정보 */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">이름</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="워크스페이스 이름"
                className="h-8 text-xs font-mono"
              />
              {workspace ? (
                <p className="text-2xs text-muted-foreground font-mono truncate">
                  {workspace.repo_url}
                </p>
              ) : null}
            </div>

            <Separator />

            {/* 검증 명령 */}
            <ValidationCommandEditor
              commands={commands}
              onChange={setCommands}
            />
          </div>
        </ScrollArea>

        <SheetFooter className="px-6 py-3 border-t border-border">
          <div className="flex items-center gap-2 w-full justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : null}
              {updateMutation.isPending ? "저장 중…" : "저장"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
});
