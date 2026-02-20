import { useState } from "react";
import { GitBranch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/store";
import { DirectoryBrowser } from "@/features/directory/components/DirectoryBrowser";
import { GitMonitorRepoSection } from "./GitMonitorRepoSection";

export function GitMonitorPanel() {
  const gitMonitorPaths = useSessionStore((s) => s.gitMonitorPaths);
  const addGitMonitorPath = useSessionStore((s) => s.addGitMonitorPath);
  const removeGitMonitorPath = useSessionStore((s) => s.removeGitMonitorPath);
  const [browserOpen, setBrowserOpen] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-hidden border-t border-border">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <GitBranch className="h-3.5 w-3.5 text-info shrink-0" />
        <span className="font-mono text-xs font-semibold text-foreground shrink-0">
          Git Monitor
        </span>
        {gitMonitorPaths.length > 0 ? (
          <span className="font-mono text-2xs text-muted-foreground shrink-0">
            {gitMonitorPaths.length}개 저장소
          </span>
        ) : null}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => setBrowserOpen(true)}
          aria-label="Git 저장소 추가"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* 저장소 섹션 목록 (횡 배치) */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {gitMonitorPaths.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <GitBranch className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <div className="font-mono text-xs text-muted-foreground mb-2">
              모니터링할 Git 저장소를 추가하세요
            </div>
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-xs"
              onClick={() => setBrowserOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              저장소 추가
            </Button>
          </div>
        ) : (
          <div className="flex h-full gap-0 overflow-x-auto">
            {gitMonitorPaths.map((path) => (
              <GitMonitorRepoSection
                key={path}
                path={path}
                defaultOpen
                onRemove={removeGitMonitorPath}
              />
            ))}
          </div>
        )}
      </div>

      <DirectoryBrowser
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        initialPath="~"
        onSelect={(path) => {
          addGitMonitorPath(path);
          setBrowserOpen(false);
        }}
      />
    </div>
  );
}
