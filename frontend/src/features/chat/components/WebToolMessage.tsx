import { memo } from "react";
import { Globe } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ToolUseMsg } from "@/types";
import { ToolMessageShell } from "./ToolMessageShell";

interface WebToolMessageProps {
  message: ToolUseMsg;
}

export const WebToolMessage = memo(function WebToolMessage({ message }: WebToolMessageProps) {
  const toolName = message.tool || "Web";
  const input = (message.input || {}) as Record<string, unknown>;
  const toolStatus = message.status || "running";
  const isSearch = toolName === "WebSearch";

  const query = String(input.query ?? input.url ?? input.prompt ?? "");
  const url = input.url ? String(input.url) : null;

  return (
    <ToolMessageShell
      message={message}
      headerContent={
        <>
          <Globe className="h-3.5 w-3.5 shrink-0 text-success" />
          <span className="font-mono text-xs font-semibold text-foreground">
            {isSearch ? "WebSearch" : "WebFetch"}
          </span>
          <span className="font-mono text-xs text-muted-foreground flex-1 truncate">
            {isSearch ? `"${query}"` : query}
          </span>
        </>
      }
    >
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
          <ScrollArea className="max-h-[400px] bg-input/80 rounded-md">
            <div className="p-2.5 select-text">
              <MarkdownRenderer content={message.output} />
            </div>
          </ScrollArea>
        ) : toolStatus === "running" ? (
          <div className="font-mono text-2xs text-muted-foreground/50 italic py-2">
            {isSearch ? "검색 중" : "가져오는 중"}
            {"\u2026"}
          </div>
        ) : null}

        {message.is_truncated && message.full_length ? (
          <div className="font-mono text-2xs text-warning">
            ({message.output?.length.toLocaleString()}/{message.full_length.toLocaleString()}자
            표시)
          </div>
        ) : null}
      </div>
    </ToolMessageShell>
  );
});
