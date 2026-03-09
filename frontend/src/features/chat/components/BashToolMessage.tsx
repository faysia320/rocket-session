import { useState, memo, useRef, useCallback, useMemo } from "react";
import { Terminal, Copy, Check, Globe } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ToolUseMsg } from "@/types";
import { ToolMessageShell } from "./ToolMessageShell";

const LOCALHOST_URL_REGEX = /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)(\/[^\s"'<>)}\]]*)?/g;

interface BashToolMessageProps {
  message: ToolUseMsg;
  onOpenPreview?: (url: string) => void;
}

export const BashToolMessage = memo(function BashToolMessage({
  message,
  onOpenPreview,
}: BashToolMessageProps) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const input = (message.input || {}) as Record<string, unknown>;
  const command = String(input.command ?? "");
  const description = input.description ? String(input.description) : null;

  const headerText = description
    ? description
    : command.length > 60
      ? `${command.slice(0, 60)}\u2026`
      : command;

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(command);
        setCopied(true);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
      } catch {
        // clipboard API 미지원 환경
      }
    },
    [command],
  );

  // localhost URL 감지
  const detectedUrls = useMemo(() => {
    if (!message.output || !onOpenPreview) return [];
    const matches = message.output.matchAll(LOCALHOST_URL_REGEX);
    return [...new Set([...matches].map((m) => m[0]))];
  }, [message.output, onOpenPreview]);

  return (
    <ToolMessageShell
      message={message}
      headerContent={
        <>
          <Terminal className="h-3.5 w-3.5 shrink-0 text-warning" />
          <span className="font-mono text-xs font-semibold text-foreground">Bash</span>
          <span className="font-mono text-xs text-muted-foreground flex-1 truncate">
            {headerText}
          </span>
        </>
      }
    >
      <div className="mt-1.5 space-y-0">
        {/* Command 영역 */}
        <div className="flex items-start gap-0 rounded-t-md border border-border/50 bg-input/60">
          <ScrollArea className="flex-1 max-h-[150px]">
            <div className="p-2.5">
              <pre className="font-mono text-xs text-foreground whitespace-pre-wrap select-text">
                <span className="text-success select-none">$ </span>
                {command}
              </pre>
            </div>
          </ScrollArea>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "shrink-0 p-2 transition-colors",
              copied ? "text-success" : "text-muted-foreground/50 hover:text-foreground",
            )}
            aria-label={copied ? "복사됨" : "명령어 복사"}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>

        {/* Output 영역 */}
        {message.output ? (
          <div className="rounded-b-md border border-t-0 border-border/50 bg-input/30">
            <div className="flex items-center gap-2 px-2.5 pt-1.5">
              <span className="font-mono text-2xs text-muted-foreground/50">Output</span>
              {message.is_truncated && message.full_length ? (
                <span className="font-mono text-2xs text-warning">
                  ({message.output.length.toLocaleString()}/{message.full_length.toLocaleString()}자
                  표시)
                </span>
              ) : null}
            </div>
            <ScrollArea className="max-h-[300px]">
              <pre
                className={cn(
                  "font-mono text-xs p-2.5 whitespace-pre-wrap select-text",
                  message.is_error ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {message.output}
              </pre>
            </ScrollArea>
            {/* localhost URL 칩 */}
            {detectedUrls.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 px-2.5 py-1.5 border-t border-border/30">
                {detectedUrls.map((detectedUrl) => (
                  <button
                    key={detectedUrl}
                    type="button"
                    onClick={() => onOpenPreview?.(detectedUrl)}
                    className="flex items-center gap-1 font-mono text-2xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                  >
                    <Globe className="h-3 w-3" />
                    {detectedUrl}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="h-0" />
        )}
      </div>
    </ToolMessageShell>
  );
});
