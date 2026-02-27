import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Bot,
  Send,
  Copy,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { DiffViewer } from "@/features/files/components/DiffViewer";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ScrollArea } from "@/components/ui/scroll-area";
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
      return (
        <Badge className="bg-destructive/20 text-destructive border-destructive/30">Closed</Badge>
      );
    case "MERGED":
      return (
        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Merged</Badge>
      );
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
  const queryClient = useQueryClient();
  const { data: pr, isLoading } = useGitHubPRDetail(repoPath, open ? prNumber : null);
  const [activeTab, setActiveTab] = useState<"overview" | "diff" | "ai-review">("overview");
  const [reviewText, setReviewText] = useState<string>("");
  const [reviewError, setReviewError] = useState<string>("");
  const [reviewJobId, setReviewJobId] = useState<string | null>(null);

  const { data: diffText, isLoading: diffLoading } = useQuery({
    queryKey: ["gh-pr-diff", repoPath, prNumber],
    queryFn: () => filesystemApi.getGitHubPRDiff(repoPath, prNumber!),
    enabled: open && prNumber !== null && (activeTab === "diff" || activeTab === "ai-review"),
    staleTime: 30_000,
  });

  // Phase 1: 리뷰 작업 생성 (즉시 응답)
  const generateReview = useMutation({
    mutationFn: () => filesystemApi.generatePRReview(repoPath, prNumber!),
    onSuccess: (data) => {
      setReviewJobId(data.job_id);
      setReviewError("");
      setReviewText("");
    },
    onError: (err: Error) => {
      setReviewError(err.message);
      setReviewText("");
    },
  });

  // Phase 2: 작업 상태 폴링 (3초 간격, pending인 동안)
  const { data: reviewStatus } = useQuery({
    queryKey: ["pr-review-status", reviewJobId],
    queryFn: () => filesystemApi.getPRReviewStatus(reviewJobId!),
    enabled: !!reviewJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" ? 3000 : false;
    },
  });

  // 상태 변화 반영
  useEffect(() => {
    if (!reviewStatus) return;
    if (reviewStatus.status === "completed") {
      setReviewText(reviewStatus.review_text);
      setReviewJobId(null);
    } else if (reviewStatus.status === "error") {
      setReviewError(reviewStatus.error || "리뷰 생성 실패");
      setReviewJobId(null);
    }
  }, [reviewStatus]);

  const isReviewLoading =
    generateReview.isPending || (!!reviewJobId && reviewStatus?.status === "pending");

  // 리뷰 코멘트 게시 mutation
  const submitReview = useMutation({
    mutationFn: (body: string) => filesystemApi.submitPRReviewComment(repoPath, prNumber!, body),
    onSuccess: (data) => {
      if (data.error) {
        toast.error(`코멘트 게시 실패: ${data.error}`);
      } else {
        toast.success("PR에 리뷰 코멘트가 게시되었습니다");
        // PR 상세 정보 새로고침
        queryClient.invalidateQueries({
          queryKey: ["gh-pr-detail", repoPath, prNumber],
        });
      }
    },
    onError: (err: Error) => {
      toast.error(`코멘트 게시 실패: ${err.message}`);
    },
  });

  const handleGenerateReview = useCallback(() => {
    setReviewText("");
    setReviewError("");
    generateReview.mutate();
  }, [generateReview]);

  const handleSubmitReview = useCallback(() => {
    if (!reviewText) return;
    submitReview.mutate(reviewText);
  }, [submitReview, reviewText]);

  const handleCopyReview = useCallback(() => {
    if (!reviewText) return;
    navigator.clipboard.writeText(reviewText).then(() => {
      toast.success("리뷰 내용이 클립보드에 복사되었습니다");
    });
  }, [reviewText]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-hidden p-0"
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
                <span className="font-mono text-2xs text-muted-foreground">by {pr.author}</span>
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
                    <Badge key={label} variant="outline" className="font-mono text-2xs">
                      {label}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </SheetHeader>

            {/* 탭: Overview / Diff / AI Review */}
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "overview" | "diff" | "ai-review")}
              className="flex-1 flex flex-col min-h-0"
            >
              <TabsList className="mx-4 mt-2 shrink-0">
                <TabsTrigger value="overview" className="gap-1.5 font-mono text-xs">
                  <MessageSquare className="h-3 w-3" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="diff" className="gap-1.5 font-mono text-xs">
                  <FileText className="h-3 w-3" />
                  Diff
                </TabsTrigger>
                <TabsTrigger value="ai-review" className="gap-1.5 font-mono text-xs">
                  <Bot className="h-3 w-3" />
                  AI Review
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="overview"
                className="flex-1 overflow-hidden m-0"
              >
                <ScrollArea className="h-full">
                <div className="px-4 py-3 space-y-4">
                {/* 본문 */}
                {pr.body ? (
                  <div className="border border-border rounded-md p-3">
                    <MarkdownRenderer content={pr.body} />
                  </div>
                ) : (
                  <div className="font-mono text-xs text-muted-foreground italic">설명 없음</div>
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
                            <span className="font-mono text-xs font-medium">{review.author}</span>
                            {getReviewStateBadge(review.state)}
                          </div>
                          {review.body ? (
                            <MarkdownRenderer content={review.body} className="text-xs" />
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
                            <span className="font-mono text-xs font-medium">{comment.author}</span>
                            {comment.path ? (
                              <span className="font-mono text-2xs text-muted-foreground truncate">
                                {comment.path}
                                {comment.line ? `:${comment.line}` : ""}
                              </span>
                            ) : null}
                          </div>
                          <MarkdownRenderer content={comment.body} className="text-xs" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="diff" className="flex-1 overflow-hidden m-0">
                <ScrollArea className="h-full">
                {diffLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : diffText ? (
                  <ErrorBoundary
                    fallback={
                      <div className="font-mono text-xs text-destructive px-3 py-2">
                        Diff를 표시할 수 없습니다
                      </div>
                    }
                  >
                    <DiffViewer diff={diffText} />
                  </ErrorBoundary>
                ) : (
                  <div className="font-mono text-xs text-muted-foreground py-8 text-center">
                    Diff 없음
                  </div>
                )}
                </ScrollArea>
              </TabsContent>

              {/* AI Review 탭 */}
              <TabsContent
                value="ai-review"
                className="flex-1 overflow-hidden m-0"
              >
                <ScrollArea className="h-full">
                <div className="px-4 py-3 space-y-4">
                {/* 리뷰 생성 버튼 */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5 font-mono text-xs"
                    onClick={handleGenerateReview}
                    disabled={isReviewLoading}
                    aria-label="AI 리뷰 생성"
                  >
                    {isReviewLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Bot className="h-3 w-3" />
                    )}
                    {isReviewLoading ? "리뷰 생성 중…" : "AI 리뷰 생성"}
                  </Button>
                  {reviewText ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 font-mono text-xs"
                        onClick={handleGenerateReview}
                        disabled={isReviewLoading}
                        aria-label="리뷰 재생성"
                      >
                        <RefreshCw className="h-3 w-3" />
                        재생성
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 font-mono text-xs"
                        onClick={handleCopyReview}
                        aria-label="리뷰 복사"
                      >
                        <Copy className="h-3 w-3" />
                        복사
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-1.5 font-mono text-xs bg-success hover:bg-success/90"
                        onClick={handleSubmitReview}
                        disabled={submitReview.isPending}
                        aria-label="PR에 코멘트 게시"
                      >
                        {submitReview.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                        {submitReview.isPending ? "게시 중…" : "PR에 게시"}
                      </Button>
                    </>
                  ) : null}
                </div>

                {/* 리뷰 생성 중 안내 */}
                {isReviewLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <div className="font-mono text-sm text-muted-foreground text-center">
                      Claude Code가 PR을 분석하고 있습니다…
                    </div>
                    <div className="font-mono text-2xs text-muted-foreground text-center">
                      PR의 overview와 diff를 기반으로 리뷰를 생성합니다.
                      <br />
                      변경사항이 많을 경우 최대 2분 정도 소요될 수 있습니다.
                    </div>
                  </div>
                ) : null}

                {/* 에러 표시 */}
                {reviewError ? (
                  <div className="flex items-center gap-2 p-3 border border-destructive/30 rounded-md bg-destructive/10">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    <span className="font-mono text-xs text-destructive">{reviewError}</span>
                  </div>
                ) : null}

                {/* 리뷰 결과 미리보기 */}
                {reviewText ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                      <h3 className="font-mono text-xs font-semibold text-foreground">
                        AI 리뷰 미리보기
                      </h3>
                    </div>
                    <div className="border border-primary/30 rounded-md p-3 bg-primary/5">
                      <MarkdownRenderer content={reviewText} />
                    </div>
                  </div>
                ) : null}

                {/* 초기 상태 안내 */}
                {!isReviewLoading && !reviewText && !reviewError ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                    <Bot className="h-12 w-12 text-muted-foreground/20" />
                    <div className="font-mono text-sm text-center">
                      Claude Code로 AI 코드 리뷰를 생성합니다
                    </div>
                    <div className="font-mono text-2xs text-center max-w-sm">
                      PR의 설명과 코드 변경사항(diff)을 분석하여
                      <br />
                      요약, 좋은 점, 개선 제안, 잠재적 이슈를 포함한
                      <br />
                      리뷰를 자동으로 생성합니다.
                    </div>
                  </div>
                ) : null}
                </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
