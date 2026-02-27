import type { FileChange } from "@/types";

/** 동일 파일의 변경 이력을 병합한 항목 */
export interface MergedFileChange {
  file: string;
  tools: string[];
  count: number;
  lastTimestamp?: string;
  /** onFileClick에 전달할 대표 FileChange (마지막 변경) */
  latest: FileChange;
}

export type FileViewMode = "list" | "tree";

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: FileTreeNode[];
  fileChange?: MergedFileChange;
  fileCount: number;
}

export interface FileTreeNodeComponentProps {
  node: FileTreeNode;
  depth: number;
  sessionId: string;
  onFullView?: (change: FileChange) => void;
  openHoverFile: string | null;
  onHoverOpenChange: (file: string | null) => void;
  isMobile: boolean;
}
