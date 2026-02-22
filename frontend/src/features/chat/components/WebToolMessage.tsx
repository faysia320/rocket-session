import { useState, memo } from "react";
import { Globe, ChevronRight, ChevronDown } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ToolUseMsg } from "@/types";
import { ToolStatusIcon } from "./ToolStatusIcon";
import { useElapsed } from "./toolMessageUtils";

interface WebToolMessageProps {
  message: ToolUseMsg;
}

export const WebToolMessage = memo(function WebToolMessage({
  message,
}: WebToolMessageProps) {
  const [expanded, setExpanded] = useState(false);
  const toolName = message.tool || "Web";
  const input = (message.input || {}) as Record<string, unknown>;
  const toolStatus = message.status || "running";
  const isSearch = toolName === "WebSearch";

  const borderColor =
    toolStatus === "error"
      ? "border-l-destructive"
      : toolStatus === "done"
        ? "border-l-success"
        : "border-l-info";

  const elapsed = useElapsed(toolStatus, message.timestamp, message.completed_at);

  const query = String(input.query ?? input.url ?? input.prompt ?? "");
  const url = input.url ? String(input.url) : null;

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
            <Globe className="h-3.5 w-3.5 shrink-0 text-success" />
            <span className="font-mono text-xs font-semibold text-foreground">
              {isSearch ? "WebSearch" : "WebFetch"}
            </span>
            <span className="font-mono text-xs text-muted-foreground flex-1 truncate">
              {isSearch ? `"${query}"` : query}
            </span>
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
          <div className="mt-1.5 min-w-0 overflow-hidden space-y-1.5">
            {/* URL 링크 */}
            {url ? (
              <div className="font-mono text-2xs">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info hover:underline break-all"
                >
                  {url}
                </a>
              </div>
            ) : null}

            {/* 결과 — Markdown 렌더링 (웹 콘텐츠는 마크다운 형식일 가능성 높음) */}
            {message.output ? (
              <div className="bg-input/80 rounded-md p-2.5 overflow-auto max-h-[400px] select-text">
                <MarkdownRenderer content={message.output} />
              </div>
            ) : toolStatus === "running" ? (
              <div className="font-mono text-2xs text-muted-foreground/50 italic py-2">
                {isSearch ? "검색 중" : "가져오는 중"}{"\u2026"}
              </div>
            ) : null}

            {message.is_truncated && message.full_length ? (
              <div className="font-mono text-2xs text-warning">
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
