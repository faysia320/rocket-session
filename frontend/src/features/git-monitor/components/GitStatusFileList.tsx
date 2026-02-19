import { useState } from "react";
import {
  ChevronRight,
  Loader2,
  FileText,
  FilePlus,
  FileX,
  FilePen,
  FileQuestion,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { DiffViewer } from "@/features/files/components/DiffViewer";
import { filesystemApi } from "@/lib/api/filesystem.api";
import type { GitStatusFile } from "@/types";

interface GitStatusFileListProps {
  repoPath: string;
  files: GitStatusFile[];
}

function getStatusInfo(file: GitStatusFile) {
  const s = file.status;
  if (file.is_untracked)
    return { label: "U", color: "text-muted-foreground", Icon: FileQuestion };
  if (s.startsWith("A"))
    return { label: "A", color: "text-success", Icon: FilePlus };
  if (s.startsWith("D") || s.endsWith("D"))
    return { label: "D", color: "text-destructive", Icon: FileX };
  if (s.startsWith("R"))
    return { label: "R", color: "text-info", Icon: FilePen };
  if (s.includes("M"))
    return { label: "M", color: "text-warning", Icon: FileText };
  return { label: s.trim() || "?", color: "text-muted-foreground", Icon: FileText };
}

function GitStatusFileItem({
  repoPath,
  file,
}: {
  repoPath: string;
  file: GitStatusFile;
}) {
  const [open, setOpen] = useState(false);
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && diff === null) {
      setLoading(true);
      try {
        const result = await filesystemApi.getGitDiff(repoPath, file.path);
        setDiff(result);
      } catch {
        setDiff("");
      } finally {
        setLoading(false);
      }
    }
  };

  const { label, color, Icon } = getStatusInfo(file);

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full text-left px-2.5 py-1.5 rounded-sm hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted-foreground shrink-0 transition-transform",
                open && "rotate-90",
              )}
            />
            <Icon className={cn("h-3 w-3 shrink-0", color)} />
            <span
              className={cn(
                "font-mono text-2xs font-bold w-4 text-center shrink-0",
                color,
              )}
            >
              {label}
            </span>
            <span className="font-mono text-xs text-foreground truncate">
              {file.path}
            </span>
            {file.is_staged ? (
              <span className="font-mono text-2xs text-success/70 shrink-0">
                staged
              </span>
            ) : null}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mr-1 mb-1 border border-border rounded-sm bg-background max-h-[300px] overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : diff !== null ? (
            <DiffViewer diff={diff} />
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function GitStatusFileList({
  repoPath,
  files,
}: GitStatusFileListProps) {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="font-mono text-xs text-muted-foreground">
          변경된 파일 없음 — 워킹 트리가 깨끗합니다
        </div>
      </div>
    );
  }

  return (
    <div className="p-1.5 space-y-0.5">
      {files.map((file) => (
        <GitStatusFileItem key={file.path} repoPath={repoPath} file={file} />
      ))}
    </div>
  );
}
