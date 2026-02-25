import { memo, useState, useCallback, useMemo } from "react";
import { ChevronRight, Maximize2, Loader2, List, FolderTree, FolderOpen, Folder, FileCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { DiffViewer } from "./DiffViewer";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { cn, formatTime } from "@/lib/utils";
import { getToolBadgeStyle } from "../constants/toolColors";
import { useDiffFetch } from "../hooks/useDiffFetch";
import type { FileChange } from "@/types";

/** 동일 파일의 변경 이력을 병합한 항목 */
interface MergedFileChange {
  file: string;
  tools: string[];
  count: number;
  lastTimestamp?: string;
  /** onFileClick에 전달할 대표 FileChange (마지막 변경) */
  latest: FileChange;
}

type FileViewMode = "list" | "tree";

interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: FileTreeNode[];
  fileChange?: MergedFileChange;
  fileCount: number;
}

/** FileChange 배열을 파일 경로 기준으로 병합 (마지막 변경 기준 정렬) */
function mergeFileChanges(changes: FileChange[]): MergedFileChange[] {
  const map = new Map<string, MergedFileChange>();

  for (const change of changes) {
    const existing = map.get(change.file);
    if (existing) {
      existing.count += 1;
      if (!existing.tools.includes(change.tool)) {
        existing.tools.push(change.tool);
      }
      existing.lastTimestamp = change.timestamp;
      existing.latest = change;
    } else {
      map.set(change.file, {
        file: change.file,
        tools: [change.tool],
        count: 1,
        lastTimestamp: change.timestamp,
        latest: change,
      });
    }
  }

  // 마지막 변경 시간 역순 (최근 변경이 위로)
  return Array.from(map.values()).reverse();
}

/** MergedFileChange 배열로 파일 트리 구조 생성 */
function buildFileTree(merged: MergedFileChange[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  // 경로를 세그먼트로 분할하고 트리에 삽입
  for (const item of merged) {
    const parts = item.file.split(/[/\\]/);
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join("/");

      if (isLast) {
        // 파일 리프 노드
        currentLevel.push({
          name: part,
          path: item.file,
          isDirectory: false,
          children: [],
          fileChange: item,
          fileCount: 1,
        });
      } else {
        // 디렉토리 노드 찾기 또는 생성
        let dirNode = currentLevel.find((n) => n.isDirectory && n.path === fullPath);
        if (!dirNode) {
          dirNode = {
            name: part,
            path: fullPath,
            isDirectory: true,
            children: [],
            fileCount: 0,
          };
          currentLevel.push(dirNode);
        }
        currentLevel = dirNode.children;
      }
    }
  }

  // 단일 자식 디렉토리 체인 압축 (VS Code compact folders 패턴)
  function compactNode(node: FileTreeNode): FileTreeNode {
    if (!node.isDirectory) return node;
    node.children = node.children.map(compactNode);

    // 단일 자식이 디렉토리인 경우 이름을 합침
    while (node.children.length === 1 && node.children[0].isDirectory) {
      const child = node.children[0];
      node.name = node.name + "/" + child.name;
      node.path = child.path;
      node.children = child.children;
    }

    return node;
  }

  // 하위 파일 수 집계
  function countFiles(node: FileTreeNode): number {
    if (!node.isDirectory) return 1;
    let count = 0;
    for (const child of node.children) {
      count += countFiles(child);
    }
    node.fileCount = count;
    return count;
  }

  // 디렉토리 우선 + 알파벳순 정렬
  function sortNodes(nodes: FileTreeNode[]): FileTreeNode[] {
    return nodes
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((node) => {
        if (node.isDirectory) {
          node.children = sortNodes(node.children);
        }
        return node;
      });
  }

  const compacted = root.map(compactNode);
  compacted.forEach(countFiles);
  return sortNodes(compacted);
}

interface FilePanelProps {
  sessionId: string;
  fileChanges?: FileChange[];
  onFileClick?: (change: FileChange) => void;
}

export const FilePanel = memo(function FilePanel({
  sessionId,
  fileChanges = [],
  onFileClick,
}: FilePanelProps) {
  const [viewMode, setViewMode] = useState<FileViewMode>("list");
  const merged = useMemo(() => mergeFileChanges(fileChanges), [fileChanges]);
  const tree = useMemo(() => buildFileTree(merged), [merged]);
  const uniqueCount = merged.length;

  return (
    <div className="flex flex-col overflow-hidden flex-1 min-h-0">
      <div className="flex items-center gap-2 px-3.5 pr-12 py-2.5 border-b border-border">
        <span className="text-sm">{"\u{1F4C1}"}</span>
        <span className="font-mono text-xs font-semibold text-foreground flex-1">File Changes</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className={cn(
              "p-1 rounded transition-colors",
              viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50",
            )}
            onClick={() => setViewMode("list")}
            aria-label="목록 보기"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={cn(
              "p-1 rounded transition-colors",
              viewMode === "tree" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50",
            )}
            onClick={() => setViewMode("tree")}
            aria-label="트리 보기"
          >
            <FolderTree className="h-3.5 w-3.5" />
          </button>
        </div>
        <Badge variant="secondary" className="font-mono text-2xs">
          {uniqueCount === fileChanges.length
            ? fileChanges.length
            : `${uniqueCount} files / ${fileChanges.length} edits`}
        </Badge>
      </div>

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="p-2">
            {merged.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <div className="text-[28px] mb-2 opacity-40">{"\u{1F4C2}"}</div>
                <div className="font-mono text-xs text-muted-foreground mb-1">
                  No file changes yet
                </div>
                <div className="font-mono text-2xs text-muted-foreground/70 leading-normal">
                  Changes will appear here as Claude modifies files
                </div>
              </div>
            ) : viewMode === "list" ? (
              merged.map((item) => (
                <MergedFileChangeItem
                  key={item.file}
                  sessionId={sessionId}
                  item={item}
                  onFullView={onFileClick}
                />
              ))
            ) : (
              <FileTreeView tree={tree} sessionId={sessionId} onFullView={onFileClick} />
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
});

// ─── HoverCard Diff 콘텐츠 ──────────────────────────────────────────────────

function DiffHoverContent({ diff, loading }: { diff: string | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (diff === null) return null;
  if (!diff.trim()) {
    return (
      <div className="flex items-center justify-center py-6">
        <span className="font-mono text-xs text-muted-foreground">변경사항 없음</span>
      </div>
    );
  }
  return (
    <div className="max-h-[400px] overflow-auto">
      <ErrorBoundary
        fallback={<div className="font-mono text-xs text-destructive px-3 py-2">Diff를 표시할 수 없습니다</div>}
      >
        <DiffViewer diff={diff} />
      </ErrorBoundary>
    </div>
  );
}

/** 절대 경로이면 마지막 3세그먼트로 축약, 상대 경로는 그대로 표시 */
function shortenFilePath(filePath: string): string {
  // Windows/Unix 절대 경로 감지
  const isAbsolute = /^[A-Z]:[/\\]/i.test(filePath) || filePath.startsWith("/");
  if (!isAbsolute) return filePath;
  const parts = filePath.split(/[/\\]/);
  if (parts.length <= 3) return filePath;
  return ".../" + parts.slice(-3).join("/");
}

interface MergedFileChangeItemProps {
  sessionId: string;
  item: MergedFileChange;
  onFullView?: (change: FileChange) => void;
}

function MergedFileChangeItem({ sessionId, item, onFullView }: MergedFileChangeItemProps) {
  const { diff, loading, fetchIfNeeded } = useDiffFetch(sessionId, item.file);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) fetchIfNeeded();
    },
    [fetchIfNeeded],
  );

  const handleClick = useCallback(() => {
    onFullView?.(item.latest);
  }, [onFullView, item.latest]);

  return (
    <HoverCard openDelay={300} closeDelay={150} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          className="w-full text-left p-2 px-2.5 bg-secondary border border-border rounded-sm animate-[fadeIn_0.2s_ease] hover:border-primary/30 hover:bg-secondary/80 transition-colors cursor-pointer mb-1.5"
          aria-label={`파일 보기: ${item.file}`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            {item.tools.map((tool) => (
              <Badge
                key={tool}
                variant="outline"
                className="font-mono text-2xs"
                style={getToolBadgeStyle(tool)}
              >
                {tool}
              </Badge>
            ))}
            {item.count > 1 ? (
              <Badge variant="secondary" className="font-mono text-2xs">
                {`\u00D7${item.count}`}
              </Badge>
            ) : null}
            <span className="font-mono text-2xs text-muted-foreground/70 ml-auto shrink-0">
              {item.lastTimestamp ? formatTime(item.lastTimestamp) : null}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="ml-1 p-0.5 rounded hover:bg-muted transition-colors shrink-0 inline-flex"
                  aria-label={`전체 보기: ${item.file}`}
                >
                  <Maximize2 className="h-3 w-3 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent>전체 보기</TooltipContent>
            </Tooltip>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="font-mono text-xs text-primary break-all pl-1">
                {shortenFilePath(item.file)}
              </div>
            </TooltipTrigger>
            <TooltipContent className="font-mono text-xs">{item.file}</TooltipContent>
          </Tooltip>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="left"
        align="start"
        sideOffset={8}
        className="w-[480px] max-h-[400px] overflow-hidden p-0"
      >
        <DiffHoverContent diff={diff} loading={loading} />
      </HoverCardContent>
    </HoverCard>
  );
}

// ─── 트리 뷰 컴포넌트 ──────────────────────────────────────────────────────────

interface FileTreeViewProps {
  tree: FileTreeNode[];
  sessionId: string;
  onFullView?: (change: FileChange) => void;
}

function FileTreeView({ tree, sessionId, onFullView }: FileTreeViewProps) {
  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <FileTreeNodeComponent key={node.path} node={node} depth={0} sessionId={sessionId} onFullView={onFullView} />
      ))}
    </div>
  );
}

interface FileTreeNodeComponentProps {
  node: FileTreeNode;
  depth: number;
  sessionId: string;
  onFullView?: (change: FileChange) => void;
}

function FileTreeNodeComponent({ node, depth, sessionId, onFullView }: FileTreeNodeComponentProps) {
  if (node.isDirectory) {
    return <FileTreeFolderNode node={node} depth={depth} sessionId={sessionId} onFullView={onFullView} />;
  }
  return <FileTreeFileNode node={node} depth={depth} sessionId={sessionId} onFullView={onFullView} />;
}

function FileTreeFolderNode({ node, depth, sessionId, onFullView }: FileTreeNodeComponentProps) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-1.5 py-1 px-1.5 rounded-sm hover:bg-muted/50 transition-colors cursor-pointer"
          style={{ paddingLeft: depth * 16 + 8 }}
          aria-label={`폴더: ${node.name}`}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
              open && "rotate-90",
            )}
          />
          {open ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary/70" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-primary/70" />
          )}
          <span className="font-mono text-xs text-foreground truncate">{node.name}</span>
          <span className="font-mono text-2xs text-muted-foreground ml-auto shrink-0">({node.fileCount})</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {node.children.map((child) => (
          <FileTreeNodeComponent
            key={child.path}
            node={child}
            depth={depth + 1}
            sessionId={sessionId}
            onFullView={onFullView}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function FileTreeFileNode({ node, depth, sessionId, onFullView }: FileTreeNodeComponentProps) {
  const item = node.fileChange!;
  const { diff, loading, fetchIfNeeded } = useDiffFetch(sessionId, item.file);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) fetchIfNeeded();
    },
    [fetchIfNeeded],
  );

  const handleClick = useCallback(() => {
    onFullView?.(item.latest);
  }, [onFullView, item.latest]);

  return (
    <HoverCard openDelay={300} closeDelay={150} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center gap-1.5 py-1 px-1.5 rounded-sm hover:bg-muted/50 transition-colors cursor-pointer"
          style={{ paddingLeft: depth * 16 + 8 }}
          aria-label={`파일 보기: ${node.name}`}
        >
          <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="font-mono text-xs text-primary truncate">{node.name}</span>
          {item.tools.map((tool) => (
            <Badge key={tool} variant="outline" className="font-mono text-2xs shrink-0" style={getToolBadgeStyle(tool)}>
              {tool}
            </Badge>
          ))}
          {item.count > 1 ? (
            <Badge variant="secondary" className="font-mono text-2xs shrink-0">{`\u00D7${item.count}`}</Badge>
          ) : null}
          <span className="font-mono text-2xs text-muted-foreground/70 ml-auto shrink-0">
            {item.lastTimestamp ? formatTime(item.lastTimestamp) : null}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="ml-1 p-0.5 rounded hover:bg-muted transition-colors shrink-0 inline-flex"
                aria-label={`전체 보기: ${item.file}`}
              >
                <Maximize2 className="h-3 w-3 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent>전체 보기</TooltipContent>
          </Tooltip>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="left"
        align="start"
        sideOffset={8}
        className="w-[480px] max-h-[400px] overflow-hidden p-0"
      >
        <DiffHoverContent diff={diff} loading={loading} />
      </HoverCardContent>
    </HoverCard>
  );
}
