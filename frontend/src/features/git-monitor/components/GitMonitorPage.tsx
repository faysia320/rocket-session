import { useState, useCallback } from "react";
import { GitBranch, Plus, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useWorkspaces } from "@/features/workspace/hooks/useWorkspaces";
import { WorkspaceCreateDialog } from "@/features/workspace/components/WorkspaceCreateDialog";
import { GitMonitorRepoList } from "./GitMonitorRepoList";
import { GitRepoStatusTab } from "./GitRepoStatusTab";
import { GitCommitHistoryTab } from "./GitCommitHistoryTab";
import { GitHubPRTab } from "./GitHubPRTab";
import type { WorkspaceInfo } from "@/types/workspace";

export function GitMonitorPage() {
  const { data: workspaces, isLoading } = useWorkspaces();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const isMobile = useIsMobile();

  const readyWorkspaces = workspaces ?? [];

  // 선택된 워크스페이스가 목록에 없으면 첫 번째로 이동
  const selectedWorkspace =
    readyWorkspaces.find((ws) => ws.id === selectedWorkspaceId) ?? readyWorkspaces[0] ?? null;
  const effectiveId = selectedWorkspace?.id ?? null;

  const handleSelect = useCallback((id: string) => setSelectedWorkspaceId(id), []);
  const handleAdd = useCallback(() => setCreateOpen(true), []);

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
              <WorkspaceContent workspace={selectedWorkspace} />
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

function WorkspaceContent({ workspace }: { workspace: WorkspaceInfo }) {
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

  // ready 상태: 액션 바 + Status/Commits | Pull Requests
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
      </div>

      {/* 좌우 2분할: Status/Commits (좌) | Pull Requests (우) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 좌측: Status / Commits 서브탭 */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-border">
          <Tabs defaultValue="status" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-4 mt-3 shrink-0">
              <TabsTrigger value="status" className="gap-1.5 font-mono text-xs">
                Status
              </TabsTrigger>
              <TabsTrigger value="commits" className="gap-1.5 font-mono text-xs">
                Commits
              </TabsTrigger>
            </TabsList>

            <TabsContent value="status" className="flex-1 overflow-auto px-4 py-3 m-0">
              <GitRepoStatusTab repoPath={workspace.local_path} />
            </TabsContent>

            <TabsContent value="commits" className="flex-1 overflow-auto px-4 py-3 m-0">
              <GitCommitHistoryTab repoPath={workspace.local_path} />
            </TabsContent>
          </Tabs>
        </div>

        {/* 우측: Pull Requests */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-auto px-4 py-3">
            <GitHubPRTab repoPath={workspace.local_path} />
          </div>
        </div>
      </div>
    </div>
  );
}
