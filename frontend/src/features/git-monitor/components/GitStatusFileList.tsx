import { useState, type ReactNode } from "react";
import {
  ChevronRight,
  Loader2,
  FileText,
  FilePlus,
  FileX,
  FilePen,
  FileQuestion,
  Plus,
  Minus,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { DiffViewer } from "@/features/files/components/DiffViewer";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { filesystemApi } from "@/lib/api/filesystem.api";
import { useStageFiles, useUnstageFiles } from "../hooks/useGitActions";
import type { GitStatusFile } from "@/types";

interface GitStatusFileListProps {
  repoPath: string;
  files: GitStatusFile[];
}

function getStatusInfo(file: GitStatusFile) {
  const s = file.status;
  if (file.is_untracked) return { label: "U", color: "text-muted-foreground", Icon: FileQuestion };
  if (s.startsWith("A")) return { label: "A", color: "text-success", Icon: FilePlus };
  if (s.startsWith("D") || s.endsWith("D"))
    return { label: "D", color: "text-destructive", Icon: FileX };
  if (s.startsWith("R")) return { label: "R", color: "text-info", Icon: FilePen };
  if (s.includes("M")) return { label: "M", color: "text-warning", Icon: FileText };
  return { label: s.trim() || "?", color: "text-muted-foreground", Icon: FileText };
}

/* ── 개별 파일 항목 ── */

interface FileItemAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  isPending: boolean;
}

function GitStatusFileItem({
  repoPath,
  file,
  action,
}: {
  repoPath: string;
  file: GitStatusFile;
  action: FileItemAction;
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
      <div className="flex items-center group">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex-1 text-left px-2.5 py-1.5 rounded-sm hover:bg-muted transition-colors min-w-0"
          >
            <div className="flex items-center gap-1.5">
              <ChevronRight
                className={cn(
                  "h-3 w-3 text-muted-foreground shrink-0 transition-transform",
                  open && "rotate-90",
                )}
              />
              <Icon className={cn("h-3 w-3 shrink-0", color)} />
              <span className={cn("font-mono text-2xs font-bold w-4 text-center shrink-0", color)}>
                {label}
              </span>
              <span className="font-mono text-xs text-foreground truncate">{file.path}</span>
            </div>
          </button>
        </CollapsibleTrigger>
        <button
          type="button"
          className="shrink-0 p-1 rounded-sm hover:bg-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity mr-1"
          onClick={(e) => {
            e.stopPropagation();
            action.onClick();
          }}
          disabled={action.isPending}
          aria-label={action.label}
          title={action.label}
        >
          {action.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            action.icon
          )}
        </button>
      </div>
      <CollapsibleContent>
        <div className="ml-4 mr-1 mb-1 border border-border rounded-sm bg-background max-h-[300px] overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : diff !== null ? (
            <ErrorBoundary fallback={<div className="font-mono text-xs text-destructive px-3 py-2">Diff를 표시할 수 없습니다</div>}>
              <DiffViewer diff={diff} />
            </ErrorBoundary>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Collapsible 섹션 헤더 ── */

interface FileSectionProps {
  title: string;
  count: number;
  defaultOpen?: boolean;
  headerAction?: {
    label: string;
    onClick: () => void;
    isPending: boolean;
  };
  children: ReactNode;
}

function FileSection({ title, count, defaultOpen = true, headerAction, children }: FileSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex-1 flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-muted/50 rounded-sm transition-colors"
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 text-muted-foreground shrink-0 transition-transform",
                open && "rotate-90",
              )}
            />
            <span className="font-mono text-xs font-semibold text-muted-foreground">
              {title}
            </span>
            <span className="font-mono text-2xs text-muted-foreground/60">
              ({count})
            </span>
          </button>
        </CollapsibleTrigger>
        {headerAction ? (
          <button
            type="button"
            className="shrink-0 px-1.5 py-0.5 mr-1 rounded-sm text-2xs font-mono text-muted-foreground hover:bg-muted-foreground/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              headerAction.onClick();
            }}
            disabled={headerAction.isPending}
          >
            {headerAction.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin inline" />
            ) : (
              headerAction.label
            )}
          </button>
        ) : null}
      </div>
      <CollapsibleContent>
        <div className="space-y-0.5">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── 메인 컴포넌트 ── */

export function GitStatusFileList({ repoPath, files }: GitStatusFileListProps) {
  const stageMutation = useStageFiles(repoPath);
  const unstageMutation = useUnstageFiles(repoPath);

  const stagedFiles = files.filter((f) => f.is_staged);
  const unstagedFiles = files.filter((f) => f.is_unstaged || f.is_untracked);

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
    <div className="p-1.5 space-y-1">
      <FileSection
        title="Staged Changes"
        count={stagedFiles.length}
        headerAction={{
          label: "Unstage All",
          onClick: () => unstageMutation.mutate(undefined),
          isPending: unstageMutation.isPending,
        }}
      >
        {stagedFiles.map((file) => (
          <GitStatusFileItem
            key={`staged-${file.path}`}
            repoPath={repoPath}
            file={file}
            action={{
              icon: <Minus className="h-3.5 w-3.5 text-muted-foreground" />,
              label: `Unstage ${file.path}`,
              onClick: () => unstageMutation.mutate([file.path]),
              isPending: unstageMutation.isPending,
            }}
          />
        ))}
      </FileSection>

      <FileSection
        title="Changes"
        count={unstagedFiles.length}
        headerAction={{
          label: "Stage All",
          onClick: () => stageMutation.mutate(undefined),
          isPending: stageMutation.isPending,
        }}
      >
        {unstagedFiles.map((file) => (
          <GitStatusFileItem
            key={`unstaged-${file.path}`}
            repoPath={repoPath}
            file={file}
            action={{
              icon: <Plus className="h-3.5 w-3.5 text-muted-foreground" />,
              label: `Stage ${file.path}`,
              onClick: () => stageMutation.mutate([file.path]),
              isPending: stageMutation.isPending,
            }}
          />
        ))}
      </FileSection>
    </div>
  );
}
