import { useState, useCallback } from "react";
import {
  Loader2,
  AlertCircle,
  GitPullRequest,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGhStatus, useGitHubPRs } from "../hooks/useGitHubPRs";
import { GitHubPRDetailView } from "./GitHubPRDetailView";
import type { GitHubPREntry } from "@/types";

interface GitHubPRTabProps {
  repoPath: string;
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
  return `${Math.floor(diffDay / 30)}개월 전`;
}

function PRListItem({
  pr,
  onClick,
}: {
  pr: GitHubPREntry;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors border border-border rounded-md"
      onClick={onClick}
      aria-label={`PR #${pr.number}: ${pr.title}`}
    >
      <GitPullRequest
        className={`h-3.5 w-3.5 shrink-0 ${
          pr.state === "MERGED"
            ? "text-purple-400"
            : pr.state === "CLOSED"
              ? "text-destructive"
              : "text-success"
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-2xs text-muted-foreground shrink-0">
            #{pr.number}
          </span>
          <span className="font-mono text-xs text-foreground truncate">
            {pr.title}
          </span>
          {pr.draft ? (
            <Badge
              variant="outline"
              className="font-mono text-2xs px-1 py-0 shrink-0"
            >
              Draft
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2 mt-0.5 font-mono text-2xs text-muted-foreground">
          <span>{pr.author}</span>
          <span>{pr.branch} → {pr.base}</span>
          <span className="text-success">+{pr.additions}</span>
          <span className="text-destructive">-{pr.deletions}</span>
          <span>{formatRelativeTime(pr.updated_at)}</span>
        </div>
      </div>
      {pr.labels.length > 0 ? (
        <div className="flex items-center gap-1 shrink-0">
          {pr.labels.slice(0, 2).map((label) => (
            <Badge
              key={label}
              variant="outline"
              className="font-mono text-2xs px-1 py-0"
            >
              {label}
            </Badge>
          ))}
        </div>
      ) : null}
    </button>
  );
}

export function GitHubPRTab({ repoPath }: GitHubPRTabProps) {
  const { data: ghStatus, isLoading: statusLoading } = useGhStatus(repoPath);
  const [stateFilter, setStateFilter] = useState("open");
  const [selectedPR, setSelectedPR] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const ghReady = ghStatus?.installed && ghStatus?.authenticated;
  const { data: prData, isLoading: prsLoading } = useGitHubPRs(
    repoPath,
    stateFilter,
    ghReady ?? false,
  );

  const handlePRClick = useCallback((prNumber: number) => {
    setSelectedPR(prNumber);
    setDetailOpen(true);
  }, []);

  // gh CLI 상태 체크
  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ghStatus?.installed) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 text-warning" />
        <div className="font-mono text-sm text-center">
          gh CLI가 설치되어 있지 않습니다
        </div>
        <div className="font-mono text-xs text-center max-w-sm">
          PR 리뷰 기능을 사용하려면 GitHub CLI를 설치하세요
        </div>
        <a
          href="https://cli.github.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-info hover:underline font-mono text-xs"
        >
          <ExternalLink className="h-3 w-3" />
          GitHub CLI 설치 안내
        </a>
      </div>
    );
  }

  if (!ghStatus?.authenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <AlertCircle className="h-8 w-8 text-warning" />
        <div className="font-mono text-sm text-center">
          GitHub 인증이 필요합니다
        </div>
        <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
          gh auth login
        </code>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 상태 필터 */}
      <Tabs value={stateFilter} onValueChange={setStateFilter}>
        <TabsList>
          <TabsTrigger value="open" className="font-mono text-xs">
            Open
          </TabsTrigger>
          <TabsTrigger value="closed" className="font-mono text-xs">
            Closed
          </TabsTrigger>
          <TabsTrigger value="all" className="font-mono text-xs">
            All
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* PR 목록 */}
      {prsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : prData?.error ? (
        <div className="flex items-center justify-center gap-2 py-12 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="font-mono text-sm">{prData.error}</span>
        </div>
      ) : prData?.prs.length === 0 ? (
        <div className="font-mono text-sm text-muted-foreground py-8 text-center">
          {stateFilter === "open"
            ? "열린 PR이 없습니다"
            : stateFilter === "closed"
              ? "닫힌 PR이 없습니다"
              : "PR이 없습니다"}
        </div>
      ) : (
        <div className="space-y-1">
          {prData?.prs.map((pr) => (
            <PRListItem
              key={pr.number}
              pr={pr}
              onClick={() => handlePRClick(pr.number)}
            />
          ))}
        </div>
      )}

      {/* PR 상세 Sheet */}
      <GitHubPRDetailView
        repoPath={repoPath}
        prNumber={selectedPR}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
