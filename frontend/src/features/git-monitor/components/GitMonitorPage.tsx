import { useState, useCallback } from "react";
import { GitBranch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSessionStore } from "@/store";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { DirectoryBrowser } from "@/features/directory/components/DirectoryBrowser";
import { GitMonitorRepoList } from "./GitMonitorRepoList";
import { GitRepoStatusTab } from "./GitRepoStatusTab";
import { GitCommitHistoryTab } from "./GitCommitHistoryTab";
import { GitHubPRTab } from "./GitHubPRTab";

function getFolderName(path: string): string {
  const segments = path.replace(/\/+$/, "").split("/");
  return segments[segments.length - 1] || path;
}

export function GitMonitorPage() {
  const gitMonitorPaths = useSessionStore((s) => s.gitMonitorPaths);
  const addGitMonitorPath = useSessionStore((s) => s.addGitMonitorPath);
  const removeGitMonitorPath = useSessionStore((s) => s.removeGitMonitorPath);

  const [selectedPath, setSelectedPath] = useState<string | null>(
    gitMonitorPaths[0] ?? null,
  );
  const [browserOpen, setBrowserOpen] = useState(false);
  const isMobile = useIsMobile();

  // 선택된 경로가 목록에 없으면 첫 번째로 이동
  const effectivePath =
    selectedPath && gitMonitorPaths.includes(selectedPath)
      ? selectedPath
      : gitMonitorPaths[0] ?? null;

  const handleAdd = useCallback(() => setBrowserOpen(true), []);
  const handleSelect = useCallback((path: string) => setSelectedPath(path), []);
  const handleRemove = useCallback(
    (path: string) => {
      removeGitMonitorPath(path);
      if (effectivePath === path) {
        setSelectedPath(null);
      }
    },
    [removeGitMonitorPath, effectivePath],
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-lg font-semibold text-foreground">
              Git Monitor
            </h1>
            <p className="font-mono text-xs text-muted-foreground">
              {gitMonitorPaths.length > 0
                ? `${gitMonitorPaths.length}개 저장소 모니터링 중`
                : "Git 저장소를 추가하여 모니터링하세요"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            className="gap-1.5 font-mono text-xs"
            aria-label="저장소 추가"
          >
            <Plus className="h-3.5 w-3.5" />
            저장소 추가
          </Button>
        </div>
      </div>

      {/* 콘텐츠 */}
      {gitMonitorPaths.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <GitBranch className="h-16 w-16 text-muted-foreground/20" />
          <p className="font-mono text-sm text-muted-foreground">
            모니터링할 Git 저장소가 없습니다
          </p>
          <Button
            variant="outline"
            onClick={handleAdd}
            className="font-mono text-xs"
            aria-label="첫 저장소 추가"
          >
            <Plus className="h-3 w-3 mr-1" />
            첫 저장소 추가
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* 데스크톱: 좌측 RepoList */}
          {!isMobile ? (
            <GitMonitorRepoList
              paths={gitMonitorPaths}
              selectedPath={effectivePath}
              onSelect={handleSelect}
              onRemove={handleRemove}
              onAdd={handleAdd}
            />
          ) : null}

          {/* 메인 콘텐츠 */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* 모바일: 저장소 선택 셀렉트 */}
            {isMobile ? (
              <div className="px-4 py-2 border-b border-border shrink-0">
                <Select
                  value={effectivePath ?? ""}
                  onValueChange={handleSelect}
                >
                  <SelectTrigger className="h-8 font-mono text-xs">
                    <SelectValue placeholder="저장소 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {gitMonitorPaths.map((p) => (
                      <SelectItem
                        key={p}
                        value={p}
                        className="font-mono text-xs"
                      >
                        {getFolderName(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {/* 탭: Status / Commits / Pull Requests */}
            {effectivePath ? (
              <Tabs
                defaultValue="status"
                className="flex-1 flex flex-col min-h-0"
              >
                <TabsList className="mx-4 mt-3 shrink-0">
                  <TabsTrigger
                    value="status"
                    className="gap-1.5 font-mono text-xs"
                  >
                    Status
                  </TabsTrigger>
                  <TabsTrigger
                    value="commits"
                    className="gap-1.5 font-mono text-xs"
                  >
                    Commits
                  </TabsTrigger>
                  <TabsTrigger
                    value="prs"
                    className="gap-1.5 font-mono text-xs"
                  >
                    Pull Requests
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value="status"
                  className="flex-1 overflow-auto px-4 py-3 m-0"
                >
                  <GitRepoStatusTab repoPath={effectivePath} />
                </TabsContent>

                <TabsContent
                  value="commits"
                  className="flex-1 overflow-auto px-4 py-3 m-0"
                >
                  <GitCommitHistoryTab repoPath={effectivePath} />
                </TabsContent>

                <TabsContent
                  value="prs"
                  className="flex-1 overflow-auto px-4 py-3 m-0"
                >
                  <GitHubPRTab repoPath={effectivePath} />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <span className="font-mono text-sm text-muted-foreground">
                  좌측에서 저장소를 선택하세요
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 디렉토리 브라우저 */}
      <DirectoryBrowser
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        initialPath="~"
        onSelect={(path) => {
          addGitMonitorPath(path);
          setSelectedPath(path);
          setBrowserOpen(false);
        }}
      />
    </div>
  );
}
