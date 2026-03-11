/**
 * AssistantText — Claude 어시스턴트 텍스트 메시지 (마크다운 렌더링 + 스트리밍 인디케이터)
 */
import { memo } from "react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { cn } from "@/lib/utils";
import type { AssistantTextMsg } from "@/types";

export const AssistantText = memo(function AssistantText({
  message,
  isStreaming,
  animate = false,
}: {
  message: AssistantTextMsg;
  isStreaming?: boolean;
  animate?: boolean;
}) {
  return (
    <div className={animate ? "animate-[fadeIn_0.2s_ease]" : ""}>
      <div
        className={cn(
          "px-3.5 py-3 bg-card/50 rounded-md border-l-[3px]",
          isStreaming ? "border-l-info/40" : "border-l-info/60",
        )}
      >
        <div className="flex items-center gap-1.5 font-mono text-2xs font-semibold text-muted-foreground mb-2">
          {isStreaming ? (
            <span className="inline-block w-2 h-2 rounded-full bg-info animate-pulse" />
          ) : (
            <span className="text-info text-xs">{"◆"}</span>
          )}
          <span>Claude</span>
          {isStreaming ? (
            <span className="text-info/80 animate-[pulse_1.5s_ease-in-out_infinite] ml-1">
              streaming{"…"}
            </span>
          ) : null}
        </div>
        <div className="text-foreground select-text">
          <MarkdownRenderer content={message.text || ""} />
        </div>
      </div>
    </div>
  );
});
