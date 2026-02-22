import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
  Loader2,
  AlertCircle,
  GitMerge,
  MessageSquare,
  FileText,
  Check,
  X as XIcon,
  MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { DiffViewer } from "@/features/files/components/DiffViewer";
import { useGitHubPRDetail } from "../hooks/useGitHubPRDetail";
import { filesystemApi } from "@/lib/api/filesystem.api";

interface GitHubPRDetailViewProps {
  repoPath: string;
  prNumber: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getStateBadge(state: string) {
  switch (state.toUpperCase()) {
    case "OPEN":
      return <Badge className="bg-success/20 text-success border-success/30">Open</Badge>;
    case "CLOSED":
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Closed</Badge>;
    case "MERGED":
      return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Merged</Badge>;
    default:
      return <Badge variant="secondary">{state}</Badge>;
  }
}

function getReviewStateBadge(state: string) {
  switch (state.toUpperCase()) {
    case "APPROVED":
      return (
        <span className="flex items-center gap-1 text-success font-mono text-2xs">
          <Check className="h-3 w-3" /> Approved
        </span>
      );
    case "CHANGES_REQUESTED":
      return (
        <span className="flex items-center gap-1 text-destructive font-mono text-2xs">
          <XIcon className="h-3 w-3" /> Changes Requested
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 text-muted-foreground font-mono text-2xs">
          <MessageCircle className="h-3 w-3" /> Commented
        </span>
      );
  }
}

export function GitHubPRDetailView({
  repoPath,
  prNumber,
  open,
  onOpenChange,
}: GitHubPRDetailViewProps) {
  const { data: pr, isLoading } = useGitHubPRDetail(repoPath, open ? prNumber : null);
  const [diffTab, setDiffTab] = useState<"overview" | "diff">("overview");

  const { data: diffText, isLoading: diffLoading } = useQuery({
    queryKey: ["gh-pr-diff", repoPath, prNumber],
    queryFn: () => filesystemApi.getGitHubPRDiff(repoPath, prNumber!),
    enabled: open && prNumber !== null && diffTab === "diff",
    staleTime: 30_000,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-auto p-0"
        aria-describedby={undefined}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pr?.error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
            <AlertCircle className="h-6 w-6" />
            <span className="font-mono text-sm">{pr.error}</span>
          </div>
        ) : pr ? (
          <div className="flex flex-col h-full">
            {/* 헤더 */}
            <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <GitMerge className="h-4 w-4 text-info shrink-0" />
                <SheetTitle className="font-mono text-sm font-semibold truncate flex-1">
                  #{pr.number} {pr.title}
                </SheetTitle>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {getStateBadge(pr.state)}
                <span className="font-mono text-2xs text-muted-foreground">
                  {pr.branch} → {pr.base}
                </span>
                <span className="font-mono text-2xs text-muted-foreground">
                  by {pr.author}
                </span>
                {pr.url ? (
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-info hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="font-mono text-2xs">GitHub</span>
                  </a>
                ) : null}
              </div>
              {/* 통계 */}
              <div className="flex items-center gap-3 mt-2 font-mono text-2xs text-muted-foreground">
                <span className="text-success">+{pr.additions}</span>
                <span className="text-destructive">-{pr.deletions}</span>
                <span>{pr.changed_files} files</span>
                <span>{pr.commits_count} commits</span>
              </div>
              {pr.labels.length > 0 ? (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {pr.labels.map((label) => (
                    <Badge
                      key={label}
                      variant="outline"
                      className="font-mono text-2xs"
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </SheetHeader>

            {/* 탭: Overview / Diff */}
            <Tabs
              value={diffTab}
              onValueChange={(v) => setDiffTab(v as "overview" | "diff")}
              className="flex-1 flex flex-col min-h-0"
            >
              <TabsList className="mx-4 mt-2 shrink-0">
                <TabsTrigger
                  value="overview"
                  className="gap-1.5 font-mono text-xs"
                >
                  <MessageSquare className="h-3 w-3" />
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="diff"
                  className="gap-1.5 font-mono text-xs"
                >
                  <FileText className="h-3 w-3" />
                  Diff
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="overview"
                className="flex-1 overflow-auto px-4 py-3 m-0 space-y-4"
              >
                {/* 본문 */}
                {pr.body ? (
                  <div className="border border-border rounded-md p-3">
                    <MarkdownRenderer content={pr.body} />
                  </div>
                ) : (
                  <div className="font-mono text-xs text-muted-foreground italic">
                    설명 없음
                  </div>
                )}

                {/* 리뷰 */}
                {pr.reviews.length > 0 ? (
                  <div>
                    <h3 className="font-mono text-xs font-semibold text-foreground mb-2">
                      Reviews ({pr.reviews.length})
                    </h3>
                    <div className="space-y-2">
                      {pr.reviews.map((review, i) => (
                        <div
                          key={`review-${i}`}
                          className="border border-border rounded-md p-3 space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-medium">
                              {review.author}
                            </span>
                            {getReviewStateBadge(review.state)}
                          </div>
                          {review.body ? (
                            <div className="text-xs text-muted-foreground">
                              <MarkdownRenderer content={review.body} />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* 코멘트 */}
                {pr.comments.length > 0 ? (
                  <div>
                    <h3 className="font-mono text-xs font-semibold text-foreground mb-2">
                      Comments ({pr.comments.length})
                    </h3>
                    <div className="space-y-2">
                      {pr.comments.map((comment, i) => (
                        <div
                          key={`comment-${i}`}
                          className="border border-border rounded-md p-3 space-y-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-medium">
                              {comment.author}
                            </span>
                            {comment.path ? (
                              <span className="font-mono text-2xs text-muted-foreground truncate">
                                {comment.path}
                                {comment.line ? `:${comment.line}` : ""}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <MarkdownRenderer content={comment.body} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent
                value="diff"
                className="flex-1 overflow-auto m-0"
              >
                {diffLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : diffText ? (
                  <DiffViewer diff={diffText} />
                ) : (
                  <div className="font-mono text-xs text-muted-foreground py-8 text-center">
                    Diff 없음
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
