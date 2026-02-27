import { Loader2, Maximize2 } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DiffViewer } from "./DiffViewer";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

interface DiffHoverContentProps {
  diff: string | null;
  loading: boolean;
  fileName?: string;
  onFullView?: () => void;
}

export function DiffHoverContent({ diff, loading, fileName, onFullView }: DiffHoverContentProps) {
  return (
    <>
      {/* 헤더바: 파일명 + 전체보기 버튼 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-secondary/30 shrink-0">
        <span className="font-mono text-2xs text-muted-foreground truncate">{fileName || ""}</span>
        {onFullView ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFullView();
                }}
                className="p-1 rounded hover:bg-muted transition-colors shrink-0"
                aria-label="전체 보기"
              >
                <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent>전체 보기</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {/* Diff 콘텐츠 */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : diff === null ? null : !diff.trim() ? (
        <div className="flex items-center justify-center py-6">
          <span className="font-mono text-xs text-muted-foreground">변경사항 없음</span>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <ErrorBoundary
            fallback={
              <div className="font-mono text-xs text-destructive px-3 py-2">
                Diff를 표시할 수 없습니다
              </div>
            }
          >
            <DiffViewer diff={diff} hideHeaders />
          </ErrorBoundary>
        </div>
      )}
    </>
  );
}
