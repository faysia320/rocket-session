import { useState, memo, useRef, useCallback } from "react";
import { Terminal, ChevronRight, ChevronDown, Copy, Check } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ToolUseMsg } from "@/types";
import { ToolStatusIcon } from "./ToolStatusIcon";
import { useElapsed } from "./toolMessageUtils";

interface BashToolMessageProps {
  message: ToolUseMsg;
}

export const BashToolMessage = memo(function BashToolMessage({
  message,
}: BashToolMessageProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const input = (message.input || {}) as Record<string, unknown>;
  const toolStatus = message.status || "running";
  const command = String(input.command ?? "");
  const description = input.description ? String(input.description) : null;

  const borderColor =
    toolStatus === "error"
      ? "border-l-destructive"
      : toolStatus === "done"
        ? "border-l-success"
        : "border-l-info";

  const elapsed = useElapsed(toolStatus, message.timestamp, message.completed_at);

  const headerText = description
    ? description
    : command.length > 60
      ? `${command.slice(0, 60)}\u2026`
      : command;

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API 미지원 환경
    }
  }, [command]);

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
            <Terminal className="h-3.5 w-3.5 shrink-0 text-warning" />
            <span className="font-mono text-xs font-semibold text-foreground">
              Bash
            </span>
            <span className="font-mono text-xs text-muted-foreground flex-1 truncate">
              {headerText}
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
          <div className="mt-1.5 space-y-0">
            {/* Command 영역 */}
            <div className="flex items-start gap-0 rounded-t-md border border-border/50 bg-input/60">
              <div className="flex-1 p-2.5 overflow-auto max-h-[150px]">
                <pre className="font-mono text-xs text-foreground whitespace-pre-wrap select-text">
                  <span className="text-success select-none">$ </span>
                  {command}
                </pre>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  "shrink-0 p-2 transition-colors",
                  copied
                    ? "text-success"
                    : "text-muted-foreground/50 hover:text-foreground",
                )}
                aria-label={copied ? "복사됨" : "명령어 복사"}
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>

            {/* Output 영역 */}
            {message.output ? (
              <div className="rounded-b-md border border-t-0 border-border/50 bg-input/30">
                <div className="flex items-center gap-2 px-2.5 pt-1.5">
                  <span className="font-mono text-2xs text-muted-foreground/50">
                    Output
                  </span>
                  {message.is_truncated && message.full_length ? (
                    <span className="font-mono text-2xs text-warning">
                      ({message.output.length.toLocaleString()}/
                      {message.full_length.toLocaleString()}자 표시)
                    </span>
                  ) : null}
                </div>
                <pre
                  className={cn(
                    "font-mono text-xs p-2.5 overflow-auto max-h-[300px] whitespace-pre-wrap select-text",
                    message.is_error
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {message.output}
                </pre>
              </div>
            ) : (
              <div className="h-0" />
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});
