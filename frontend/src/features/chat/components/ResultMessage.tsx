/**
 * ResultMessage — Claude 최종 응답 결과 메시지 (토큰/비용/모델 메타데이터 포함)
 */
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { cn, formatTokens } from "@/lib/utils";
import type { ResultMsg } from "@/types";
import { formatModelName } from "./toolMessageUtils";

export function ResultMessage({
  message,
  animate = false,
}: {
  message: ResultMsg;
  animate?: boolean;
}) {
  const hasMetadata = message.duration_ms || message.model || message.input_tokens;

  return (
    <div className={animate ? "animate-[fadeIn_0.2s_ease]" : ""}>
      <div
        className={cn(
          "px-3.5 py-3 bg-card/50 rounded-md border-l-[3px] border-l-info/60",
          message.is_error && "border-l-destructive bg-destructive/5",
        )}
      >
        <div className="flex items-center gap-1.5 font-mono text-2xs font-semibold text-muted-foreground mb-2">
          <span className="text-info text-xs">{"◆"}</span> Claude
          {message.is_error ? (
            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-destructive/15 text-destructive border border-destructive/30">
              Error
            </span>
          ) : null}
        </div>
        <div className="text-foreground select-text">
          <MarkdownRenderer content={message.text || ""} />
        </div>
        {hasMetadata ? (
          <div className="flex flex-wrap gap-2 mt-2.5 pt-2 border-t border-border/30">
            {message.model ? (
              <span className="font-mono text-2xs px-2 py-0.5 rounded-md bg-info/10 text-info border border-info/20">
                {formatModelName(message.model)}
              </span>
            ) : null}
            {message.duration_ms ? (
              <span className="font-mono text-2xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                {(message.duration_ms / 1000).toFixed(1)}s
              </span>
            ) : null}
            {message.input_tokens ? (
              <span className="font-mono text-2xs px-2 py-0.5 rounded-md bg-success/10 text-success border border-success/20">
                in:{formatTokens(message.input_tokens)}
                {message.cache_read_tokens
                  ? ` (cache:${formatTokens(message.cache_read_tokens)})`
                  : ""}
              </span>
            ) : null}
            {message.output_tokens ? (
              <span className="font-mono text-2xs px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                out:{formatTokens(message.output_tokens)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
