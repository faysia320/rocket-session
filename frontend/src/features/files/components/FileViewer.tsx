import { useState, useEffect } from "react";
import { FileCode, Loader2, ArrowLeftRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { sessionsApi } from "@/lib/api/sessions.api";
import { DiffViewer } from "./DiffViewer";
import { cn, formatTime } from "@/lib/utils";
import { getToolBadgeStyle } from "../constants/toolColors";

interface FileViewerProps {
  sessionId: string;
  filePath: string;
  tool: string;
  timestamp?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ViewTab = "content" | "diff";

export function FileViewer({
  sessionId,
  filePath,
  tool,
  timestamp,
  open,
  onOpenChange,
}: FileViewerProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>("diff");
  const [content, setContent] = useState<string | null>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setContent(null);
    setDiff(null);

    // 두 요청을 병렬로 수행
    const fetchContent = sessionsApi
      .fileContent(sessionId, filePath)
      .catch(() => null);
    const fetchDiff = sessionsApi
      .fileDiff(sessionId, filePath)
      .catch(() => null);

    Promise.all([fetchContent, fetchDiff]).then(
      ([contentResult, diffResult]) => {
        if (contentResult === null && diffResult === null) {
          setError("파일 내용과 diff를 모두 가져올 수 없습니다.");
        } else {
          setContent(contentResult);
          setDiff(diffResult);
          // diff가 있으면 diff 탭, 없으면 content 탭
          setActiveTab(diffResult ? "diff" : "content");
        }
        setLoading(false);
      },
    );
  }, [sessionId, filePath, open]);

  const fileName = filePath.split(/[/\\]/).pop() ?? filePath;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col overflow-hidden bg-card border-border p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border bg-secondary">
          <div className="flex items-center gap-2">
            <FileCode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <DialogTitle
              className="font-mono text-xs text-foreground truncate"
              title={filePath}
            >
              {fileName}
            </DialogTitle>
          </div>
          <DialogDescription className="flex items-center gap-1.5 mt-0.5">
            <Badge
              variant="outline"
              className="font-mono text-[9px] px-1 py-0"
              style={getToolBadgeStyle(tool)}
            >
              {tool}
            </Badge>
            {timestamp ? (
              <span className="font-mono text-[9px] text-muted-foreground/70">
                {formatTime(timestamp)}
              </span>
            ) : null}
            <span
              className="font-mono text-2xs text-muted-foreground truncate ml-1"
              title={filePath}
            >
              {filePath}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex border-b border-border bg-secondary/50 px-4">
          <button
            type="button"
            onClick={() => setActiveTab("diff")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-medium border-b-2 transition-colors",
              activeTab === "diff"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            aria-label="Diff 보기"
          >
            <ArrowLeftRight className="h-3 w-3" />
            Diff
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("content")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-medium border-b-2 transition-colors",
              activeTab === "content"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            aria-label="파일 내용 보기"
          >
            <FileCode className="h-3 w-3" />
            Content
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="font-mono text-xs text-destructive mb-1">
                  파일을 불러올 수 없습니다
                </div>
                <div className="font-mono text-2xs text-muted-foreground">
                  {error}
                </div>
              </div>
            ) : activeTab === "diff" ? (
              diff ? (
                <DiffViewer diff={diff} />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="font-mono text-xs text-muted-foreground mb-1">
                    Git diff를 사용할 수 없습니다
                  </div>
                  <div className="font-mono text-2xs text-muted-foreground/70">
                    Git 저장소가 아니거나 커밋된 변경사항이 없습니다
                  </div>
                </div>
              )
            ) : (
              <pre className="px-4 py-3 font-mono text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap break-all">
                {content || "(빈 파일)"}
              </pre>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
