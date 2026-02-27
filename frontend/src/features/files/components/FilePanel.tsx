import { memo, useState, useMemo } from "react";
import { List, FolderTree } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MergedFileChangeItem } from "./MergedFileChangeItem";
import { FileTreeView } from "./FileTreeView";
import { mergeFileChanges, buildFileTree } from "./fileTreeUtils";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMediaQuery";
import type { FileChange } from "@/types";
import type { FileViewMode } from "./types";

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
  const [viewMode, setViewMode] = useState<FileViewMode>("tree");
  const [openHoverFile, setOpenHoverFile] = useState<string | null>(null);
  const isMobile = useIsMobile();
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
              viewMode === "tree"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50",
            )}
            onClick={() => { setOpenHoverFile(null); setViewMode("tree"); }}
            aria-label="트리 보기"
          >
            <FolderTree className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={cn(
              "p-1 rounded transition-colors",
              viewMode === "list"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50",
            )}
            onClick={() => { setOpenHoverFile(null); setViewMode("list"); }}
            aria-label="목록 보기"
          >
            <List className="h-3.5 w-3.5" />
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
                  isHoverOpen={openHoverFile === item.file}
                  onHoverOpenChange={setOpenHoverFile}
                  isMobile={isMobile}
                />
              ))
            ) : (
              <FileTreeView
                tree={tree}
                sessionId={sessionId}
                onFullView={onFileClick}
                openHoverFile={openHoverFile}
                onHoverOpenChange={setOpenHoverFile}
                isMobile={isMobile}
              />
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
});
