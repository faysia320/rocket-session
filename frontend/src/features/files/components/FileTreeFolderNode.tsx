import { memo, useState } from "react";
import { ChevronRight, FolderOpen, Folder } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileTreeNodeComponent } from "./FileTreeView";
import { cn } from "@/lib/utils";
import type { FileTreeNodeComponentProps } from "./types";

export const FileTreeFolderNode = memo(function FileTreeFolderNode({
  node,
  depth,
  sessionId,
  onFullView,
  openHoverFile,
  onHoverOpenChange,
  isMobile,
}: FileTreeNodeComponentProps) {
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
          <span className="font-mono text-2xs text-muted-foreground ml-auto shrink-0">
            ({node.fileCount})
          </span>
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
            openHoverFile={openHoverFile}
            onHoverOpenChange={onHoverOpenChange}
            isMobile={isMobile}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
});
