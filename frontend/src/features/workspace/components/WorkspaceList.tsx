import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  Globe,
  HardDrive,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useWorkspaces, useDeleteWorkspace, useSyncWorkspace } from "../hooks/useWorkspaces";
import { WorkspaceCreateDialog } from "./WorkspaceCreateDialog";
import type { WorkspaceInfo } from "@/types/workspace";
import { toast } from "sonner";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  cloning: { label: "클론 중…", variant: "secondary" },
  ready: { label: "준비됨", variant: "default" },
  error: { label: "오류", variant: "destructive" },
  deleting: { label: "삭제 중…", variant: "outline" },
};

function WorkspaceCard({ workspace }: { workspace: WorkspaceInfo }) {
  const deleteMutation = useDeleteWorkspace();
  const syncMutation = useSyncWorkspace();

  const statusCfg = STATUS_CONFIG[workspace.status] ?? {
    label: workspace.status,
    variant: "outline" as const,
  };

  const handleSync = async (action: "pull" | "push") => {
    try {
      const result = await syncMutation.mutateAsync({
        id: workspace.id,
        data: { action },
      });
      toast.success(result.message);
    } catch {
      toast.error(`${action} 실패`);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(workspace.id);
      toast.success("워크스페이스가 삭제되었습니다");
    } catch {
      toast.error("삭제에 실패했습니다");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary shrink-0" />
            <span className="font-mono text-sm font-semibold truncate">{workspace.name}</span>
            <Badge variant={statusCfg.variant} className="font-mono text-2xs shrink-0">
              {statusCfg.label}
            </Badge>
          </div>
          <p className="font-mono text-2xs text-muted-foreground mt-1 truncate">
            {workspace.repo_url}
          </p>
        </div>
      </div>

      {workspace.status === "ready" ? (
        <div className="flex items-center gap-3 text-2xs font-mono text-muted-foreground">
          {workspace.current_branch ? (
            <span className="text-info">{workspace.current_branch}</span>
          ) : null}
          {workspace.is_dirty ? <span className="text-warning">변경됨</span> : null}
          {workspace.ahead ? <span className="text-success">↑{workspace.ahead}</span> : null}
          {workspace.behind ? <span className="text-destructive">↓{workspace.behind}</span> : null}
          {workspace.disk_usage_mb != null ? (
            <span className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              {workspace.disk_usage_mb}MB
            </span>
          ) : null}
          {workspace.last_synced_at ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(workspace.last_synced_at).toLocaleString("ko-KR", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : null}
        </div>
      ) : null}

      {workspace.status === "error" && workspace.error_message ? (
        <p className="font-mono text-2xs text-destructive truncate">{workspace.error_message}</p>
      ) : null}

      <div className="flex items-center gap-2">
        {workspace.status === "ready" ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-2xs h-7"
              onClick={() => handleSync("pull")}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <ArrowDownToLine className="h-3 w-3 mr-1" />
              )}
              Pull
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-2xs h-7"
              onClick={() => handleSync("push")}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <ArrowUpFromLine className="h-3 w-3 mr-1" />
              )}
              Push
            </Button>
          </>
        ) : null}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className={cn("font-mono text-2xs h-7 text-muted-foreground hover:text-destructive")}
          onClick={handleDelete}
          disabled={deleteMutation.isPending || workspace.status === "deleting"}
          aria-label="워크스페이스 삭제"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function WorkspaceList() {
  const { data: workspaces, isLoading } = useWorkspaces();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
          WORKSPACES
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="font-mono text-2xs h-7"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          추가
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !workspaces?.length ? (
        <div className="text-center py-8">
          <Globe className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="font-mono text-xs text-muted-foreground">워크스페이스가 없습니다</p>
          <p className="font-mono text-2xs text-muted-foreground/60 mt-1">
            Git 저장소를 클론하여 작업 환경을 만들어보세요
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {workspaces.map((ws) => (
            <WorkspaceCard key={ws.id} workspace={ws} />
          ))}
        </div>
      )}

      <WorkspaceCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
