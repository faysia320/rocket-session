import { useState, useCallback } from "react";
import { GitBranch, GitPullRequest, Plus, Loader2, AlertTriangle, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useWorkspaces, useDeleteWorkspace } from "@/features/workspace/hooks/useWorkspaces";
import { WorkspaceCreateDialog } from "@/features/workspace/components/WorkspaceCreateDialog";
import { useGhStatus, useGitHubPRs } from "../hooks/useGitHubPRs";
import { GitMonitorRepoList } from "./GitMonitorRepoList";
import { GitRepoStatusTab } from "./GitRepoStatusTab";
import { GitCommitHistoryTab } from "./GitCommitHistoryTab";
import { GitHubPRTab } from "./GitHubPRTab";
import type { WorkspaceInfo } from "@/types/workspace";
import { toast } from "sonner";

export function GitMonitorPage() {
  const { data: workspaces, isLoading } = useWorkspaces();
  const deleteMutation = useDeleteWorkspace();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceInfo | null>(null);
  const isMobile = useIsMobile();

  const readyWorkspaces = workspaces ?? [];

  // 선택된 워크스페이스가 목록에 없으면 첫 번째로 이동
  const selectedWorkspace =
    readyWorkspaces.find((ws) => ws.id === selectedWorkspaceId) ?? readyWorkspaces[0] ?? null;
  const effectiveId = selectedWorkspace?.id ?? null;

  const handleSelect = useCallback((id: string) => setSelectedWorkspaceId(id), []);
  const handleAdd = useCallback(() => setCreateOpen(true), []);
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const deletedId = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await deleteMutation.mutateAsync(deletedId);
      if (selectedWorkspaceId === deletedId) {
        setSelectedWorkspaceId(null);
      }
      toast.success("워크스페이스가 삭제되었습니다");
    } catch {
      toast.error("워크스페이스 삭제에 실패했습니다");
    }
  }, [deleteTarget, deleteMutation, selectedWorkspaceId]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-lg font-semibold text-foreground">Git Monitor</h1>
            <p className="font-mono text-xs text-muted-foreground">
              {isLoading
                ? "워크스페이스 로딩 중…"
                : readyWorkspaces.length > 0
                  ? `${readyWorkspaces.length}개 워크스페이스`
                  : "워크스페이스를 추가하여 모니터링하세요"}
            </p>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : readyWorkspaces.length === 0 ? (
        <EmptyState onAdd={handleAdd} />
      ) : (
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* 데스크톱: 좌측 사이드바 */}
          {!isMobile ? (
            <GitMonitorRepoList
              workspaces={readyWorkspaces}
              selectedId={effectiveId}
              onSelect={handleSelect}
              onAdd={handleAdd}
            />
          ) : null}

          {/* 메인 영역 */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* 모바일: 워크스페이스 셀렉트 */}
            {isMobile ? (
              <div className="px-4 py-2 border-b border-border shrink-0 flex gap-2">
                <Select value={effectiveId ?? ""} onValueChange={handleSelect}>
                  <SelectTrigger className="h-8 font-mono text-xs flex-1">
                    <SelectValue placeholder="워크스페이스 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {readyWorkspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id} className="font-mono text-xs">
                        {ws.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleAdd}
                  aria-label="워크스페이스 추가"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : null}

            {/* 선택된 워크스페이스 상태에 따른 렌더링 */}
            {selectedWorkspace ? (
              <WorkspaceContent workspace={selectedWorkspace} onDelete={setDeleteTarget} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <span className="font-mono text-sm text-muted-foreground">
                  좌측에서 워크스페이스를 선택하세요
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <WorkspaceCreateDialog open={createOpen} onOpenChange={setCreateOpen} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>워크스페이스 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> 워크스페이스를 삭제하시겠습니까?
              클론된 파일과 모든 데이터가 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <GitBranch className="h-16 w-16 text-muted-foreground/20" />
      <p className="font-mono text-sm text-muted-foreground">
        모니터링할 워크스페이스가 없습니다
      </p>
      <p className="font-mono text-xs text-muted-foreground/60">
        Git 저장소를 클론하여 워크스페이스를 추가하세요
      </p>
      <Button
        variant="outline"
        onClick={onAdd}
        className="font-mono text-xs"
        aria-label="첫 워크스페이스 추가"
      >
        <Plus className="h-3 w-3 mr-1" />
        워크스페이스 추가
      </Button>
    </div>
  );
}

function WorkspaceContent({ workspace, onDelete }: { workspace: WorkspaceInfo; onDelete: (ws: WorkspaceInfo) => void }) {
  if (workspace.status === "cloning") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="font-mono text-sm text-muted-foreground">클론 진행 중…</p>
        <p className="font-mono text-2xs text-muted-foreground/60">{workspace.repo_url}</p>
      </div>
    );
  }

  if (workspace.status === "error") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="font-mono text-sm text-destructive">워크스페이스 오류</p>
        {workspace.error_message ? (
          <p className="font-mono text-2xs text-muted-foreground max-w-md text-center">
            {workspace.error_message}
          </p>
        ) : null}
      </div>
    );
  }

  if (workspace.status === "deleting") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="font-mono text-sm text-muted-foreground">삭제 중…</p>
      </div>
    );
  }

  // ready 상태: 액션 바 + Status | Commits 2분할
  const { data: ghStatus } = useGhStatus(workspace.local_path);
  const ghReady = ghStatus?.installed && ghStatus?.authenticated;
  const { data: openPrData } = useGitHubPRs(workspace.local_path, "open", ghReady ?? false);
  const openPrCount = openPrData?.prs?.length ?? 0;
  const [prDialogOpen, setPrDialogOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* 액션 바 */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border">
        <span className="font-mono text-sm font-semibold text-foreground truncate">
          {workspace.name}
        </span>
        {workspace.current_branch ? (
          <Badge variant="secondary" className="font-mono text-2xs px-1.5 py-0 shrink-0">
            <GitBranch className="h-2.5 w-2.5 mr-0.5" />
            {workspace.current_branch}
          </Badge>
        ) : null}
        {workspace.is_dirty ? (
          <Badge variant="outline" className="font-mono text-2xs px-1.5 py-0 text-warning border-warning/30 shrink-0">
            변경됨
          </Badge>
        ) : null}
        {workspace.ahead ? (
          <span className="font-mono text-2xs text-success shrink-0">↑{workspace.ahead}</span>
        ) : null}
        {workspace.behind ? (
          <span className="font-mono text-2xs text-destructive shrink-0">↓{workspace.behind}</span>
        ) : null}
        <Badge
          variant="default"
          className="font-mono text-2xs px-1.5 py-0 shrink-0 cursor-pointer gap-1 hover:bg-primary/80"
          onClick={() => setPrDialogOpen(true)}
          role="button"
          aria-label={`Pull Requests: ${openPrCount}개 열림`}
        >
          <GitPullRequest className="h-2.5 w-2.5" />
          PR {openPrCount}
        </Badge>
        <div className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label="워크스페이스 옵션">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive font-mono text-xs"
              onClick={() => onDelete(workspace)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              워크스페이스 삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 좌우 2분할: Status (좌) | Commits (우) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 좌측: Status */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-border">
          <div className="shrink-0 px-4 pt-3 pb-1">
            <h3 className="font-mono text-xs font-semibold text-muted-foreground">Status</h3>
          </div>
          <div className="flex-1 overflow-auto px-4 py-2">
            <GitRepoStatusTab repoPath={workspace.local_path} />
          </div>
        </div>

        {/* 우측: Commits */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="shrink-0 px-4 pt-3 pb-1">
            <h3 className="font-mono text-xs font-semibold text-muted-foreground">Commits</h3>
          </div>
          <div className="flex-1 overflow-auto px-4 py-2">
            <GitCommitHistoryTab repoPath={workspace.local_path} />
          </div>
        </div>
      </div>

      {/* PR Dialog */}
      <Dialog open={prDialogOpen} onOpenChange={setPrDialogOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col overflow-hidden p-0 gap-0" aria-describedby={undefined}>
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <DialogTitle className="font-mono text-sm font-semibold">Pull Requests</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-6 py-4">
            <GitHubPRTab repoPath={workspace.local_path} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
