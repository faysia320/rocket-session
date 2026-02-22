import { useState, memo, useMemo } from "react";
import { FileText, ChevronRight, ChevronDown } from "lucide-react";
import { CodeBlock } from "@/components/ui/CodeBlock";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ToolUseMsg } from "@/types";
import { ToolStatusIcon } from "./ToolStatusIcon";
import { useElapsed, getLanguageFromPath } from "./toolMessageUtils";

interface ReadToolMessageProps {
  message: ToolUseMsg;
}

/** 파일 경로에서 파일명만 추출 */
function getFileName(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
}

/** 파일 확장자별 아이콘 색상 */
function getFileColor(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const colorMap: Record<string, string> = {
    ts: "text-blue-400",
    tsx: "text-blue-400",
    js: "text-yellow-400",
    jsx: "text-yellow-400",
    py: "text-green-400",
    rs: "text-orange-400",
    go: "text-cyan-400",
    css: "text-pink-400",
    html: "text-red-400",
    json: "text-yellow-300",
    md: "text-muted-foreground",
  };
  return colorMap[ext] || "text-info";
}

export const ReadToolMessage = memo(function ReadToolMessage({
  message,
}: ReadToolMessageProps) {
  const [expanded, setExpanded] = useState(false);
  const input = (message.input || {}) as Record<string, unknown>;
  const toolStatus = message.status || "running";
  const filePath = String(input.file_path ?? input.path ?? "");
  const fileName = useMemo(() => getFileName(filePath), [filePath]);
  const language = useMemo(
    () => (filePath ? getLanguageFromPath(filePath) : "text"),
    [filePath],
  );
  const fileColor = useMemo(() => getFileColor(filePath), [filePath]);

  const borderColor =
    toolStatus === "error"
      ? "border-l-destructive"
      : toolStatus === "done"
        ? "border-l-success"
        : "border-l-info";

  const elapsed = useElapsed(toolStatus, message.timestamp, message.completed_at);

  // line offset/limit 정보
  const offset = input.offset ? Number(input.offset) : null;
  const limit = input.limit ? Number(input.limit) : null;
  const rangeInfo = offset || limit
    ? `L${offset || 1}${limit ? `–${(offset || 1) + limit - 1}` : "+"}`
    : null;

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="animate-[slideInLeft_0.2s_ease] cursor-pointer"
    >
      <div
        className={cn(
          "px-3 py-2 bg-card border border-border rounded-md border-l-[3px]",
          borderColor,
        )}
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2">
            <ToolStatusIcon status={toolStatus} />
            <FileText className={cn("h-3.5 w-3.5 shrink-0", fileColor)} />
            <span className="font-mono text-xs font-semibold text-foreground">
              {fileName}
            </span>
            {fileName !== filePath ? (
              <span className="font-mono text-2xs text-muted-foreground/50 flex-1 truncate">
                {filePath}
              </span>
            ) : (
              <span className="flex-1" />
            )}
            {rangeInfo ? (
              <span className="font-mono text-2xs px-1.5 py-0.5 rounded bg-info/10 text-info border border-info/20 shrink-0">
                {rangeInfo}
              </span>
            ) : null}
            {elapsed ? (
              <span className="font-mono text-2xs text-muted-foreground/70 shrink-0">
                {elapsed}
              </span>
            ) : null}
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1.5 min-w-0 overflow-hidden">
            {message.output ? (
              <CodeBlock
                language={language}
                raw={message.output}
                className="my-0"
              >
                {message.output}
              </CodeBlock>
            ) : (
              <div className="font-mono text-2xs text-muted-foreground/50 italic py-2">
                {toolStatus === "running" ? "읽는 중\u2026" : "내용 없음"}
              </div>
            )}
            {message.is_truncated && message.full_length ? (
              <div className="font-mono text-2xs text-warning mt-1">
                ({message.output?.length.toLocaleString()}/
                {message.full_length.toLocaleString()}자 표시)
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});
