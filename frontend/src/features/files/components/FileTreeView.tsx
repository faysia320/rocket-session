import { memo } from "react";
import { FileTreeFolderNode } from "./FileTreeFolderNode";
import { FileTreeFileNode } from "./FileTreeFileNode";
import type { FileTreeNode, FileTreeNodeComponentProps } from "./types";
import type { FileChange } from "@/types";

interface FileTreeViewProps {
  tree: FileTreeNode[];
  sessionId: string;
  onFullView?: (change: FileChange) => void;
  openHoverFile: string | null;
  onHoverOpenChange: (file: string | null) => void;
  isMobile: boolean;
}

export const FileTreeView = memo(function FileTreeView({
  tree,
  sessionId,
  onFullView,
  openHoverFile,
  onHoverOpenChange,
  isMobile,
}: FileTreeViewProps) {
  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <FileTreeNodeComponent
          key={node.path}
          node={node}
          depth={0}
          sessionId={sessionId}
          onFullView={onFullView}
          openHoverFile={openHoverFile}
          onHoverOpenChange={onHoverOpenChange}
          isMobile={isMobile}
        />
      ))}
    </div>
  );
});

export const FileTreeNodeComponent = memo(function FileTreeNodeComponent({
  node,
  depth,
  sessionId,
  onFullView,
  openHoverFile,
  onHoverOpenChange,
  isMobile,
}: FileTreeNodeComponentProps) {
  if (node.isDirectory) {
    return (
      <FileTreeFolderNode
        node={node}
        depth={depth}
        sessionId={sessionId}
        onFullView={onFullView}
        openHoverFile={openHoverFile}
        onHoverOpenChange={onHoverOpenChange}
        isMobile={isMobile}
      />
    );
  }
  return (
    <FileTreeFileNode
      node={node}
      depth={depth}
      sessionId={sessionId}
      onFullView={onFullView}
      openHoverFile={openHoverFile}
      onHoverOpenChange={onHoverOpenChange}
      isMobile={isMobile}
    />
  );
});
