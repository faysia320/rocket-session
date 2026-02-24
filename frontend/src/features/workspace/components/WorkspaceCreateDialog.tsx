import { useState } from "react";
import { GitBranch, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCreateWorkspace } from "../hooks/useWorkspaces";
import { toast } from "sonner";

interface WorkspaceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkspaceCreateDialog({
  open,
  onOpenChange,
}: WorkspaceCreateDialogProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [name, setName] = useState("");
  const [autoPush, setAutoPush] = useState(false);

  const createMutation = useCreateWorkspace();

  const handleCreate = async () => {
    if (!repoUrl.trim()) return;
    try {
      await createMutation.mutateAsync({
        repo_url: repoUrl.trim(),
        branch: branch.trim() || null,
        name: name.trim() || null,
        auto_push: autoPush,
      });
      toast.success("워크스페이스 생성이 시작되었습니다");
      onOpenChange(false);
      setRepoUrl("");
      setBranch("");
      setName("");
      setAutoPush(false);
    } catch {
      toast.error("워크스페이스 생성에 실패했습니다");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            워크스페이스 추가
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Git 저장소를 클론하여 작업 환경을 생성합니다
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              REPOSITORY URL <span className="text-destructive">*</span>
            </Label>
            <Input
              className="font-mono text-xs bg-input border-border"
              placeholder="https://github.com/user/repo.git"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              BRANCH (선택)
            </Label>
            <div className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="font-mono text-xs bg-input border-border"
                placeholder="기본 브랜치 사용"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              표시 이름 (선택)
            </Label>
            <Input
              className="font-mono text-xs bg-input border-border"
              placeholder="레포 이름에서 자동 추출"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label
              htmlFor="auto-push-toggle"
              className="font-mono text-xs font-semibold text-muted-foreground tracking-wider cursor-pointer"
            >
              AUTO PUSH
            </Label>
            <Switch
              id="auto-push-toggle"
              checked={autoPush}
              onCheckedChange={setAutoPush}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="font-mono text-xs"
          >
            취소
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!repoUrl.trim() || createMutation.isPending}
            className="font-mono text-xs"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                생성 중…
              </>
            ) : (
              "Clone 시작"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
