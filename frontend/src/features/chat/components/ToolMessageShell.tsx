import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ToolUseMsg } from "@/types";
import { ToolStatusIcon } from "./ToolStatusIcon";
import { useElapsed } from "./toolMessageUtils";

interface ToolMessageShellProps {
  message: ToolUseMsg;
  /** 도구 아이콘 + 라벨 + 요약 등 헤더 커스텀 영역 */
  headerContent: React.ReactNode;
  /** elapsed 앞에 표시할 추가 요소 (range badge, result count 등) */
  headerExtra?: React.ReactNode;
  /** CollapsibleContent 내부에 렌더링할 본문 */
  children?: React.ReactNode;
}

export function ToolMessageShell({
  message,
  headerContent,
  headerExtra,
  children,
}: ToolMessageShellProps) {
  const [expanded, setExpanded] = useState(false);
  const toolStatus = message.status || "running";

  const borderColor =
    toolStatus === "error"
      ? "border-l-destructive"
      : toolStatus === "done"
        ? "border-l-success"
        : "border-l-info";

  const elapsed = useElapsed(toolStatus, message.timestamp, message.completed_at);

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
            {headerContent}
            {headerExtra}
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
        <CollapsibleContent>{children}</CollapsibleContent>
      </div>
    </Collapsible>
  );
}
