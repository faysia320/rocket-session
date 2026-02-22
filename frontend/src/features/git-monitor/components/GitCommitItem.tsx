import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { filesystemApi } from "@/lib/api/filesystem.api";
import { DiffViewer } from "@/features/files/components/DiffViewer";
import type { GitCommitEntry } from "@/types";

interface GitCommitItemProps {
  repoPath: string;
  commit: GitCommitEntry;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}일 전`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}개월 전`;
  return `${Math.floor(diffMonth / 12)}년 전`;
}

export function GitCommitItem({ repoPath, commit }: GitCommitItemProps) {
  const [expanded, setExpanded] = useState(false);

  const { data: diff, isLoading: diffLoading } = useQuery({
    queryKey: ["git-commit-diff", repoPath, commit.full_hash],
    queryFn: () => filesystemApi.getCommitDiff(repoPath, commit.full_hash),
    enabled: expanded,
    staleTime: 5 * 60_000,
  });

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
        onClick={toggle}
        aria-label={`커밋 ${commit.hash}: ${commit.message}`}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150",
            expanded && "rotate-90",
          )}
        />
        <Badge
          variant="secondary"
          className="font-mono text-2xs px-1.5 py-0 shrink-0"
        >
          {commit.hash}
        </Badge>
        <span className="font-mono text-xs text-foreground truncate flex-1">
          {commit.message}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground shrink-0">
          <User className="h-2.5 w-2.5" />
          <span className="font-mono text-2xs">{commit.author_name}</span>
        </span>
        <span className="font-mono text-2xs text-muted-foreground shrink-0">
          {formatRelativeTime(commit.date)}
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-border">
          {diffLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : diff ? (
            <DiffViewer diff={diff} />
          ) : (
            <div className="font-mono text-xs text-muted-foreground py-4 text-center">
              변경 사항 없음
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
