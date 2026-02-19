import { useState, memo } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ToolUseMsg } from "@/types";
import { ToolStatusIcon } from "./ToolStatusIcon";
import { getToolIcon, getToolColor, useElapsed } from "./toolMessageUtils";

interface EditToolMessageProps {
  message: ToolUseMsg;
}

interface EditPair {
  oldString: string;
  newString: string;
}

/** Edit/MultiEdit의 input에서 변경 쌍 추출 */
function extractEdits(message: ToolUseMsg): EditPair[] {
  const input = message.input || {};
  const toolName = message.tool;

  if (toolName === "MultiEdit") {
    const edits = input.edits as Array<{ old_string?: string; new_string?: string }> | undefined;
    if (Array.isArray(edits)) {
      return edits.map((e) => ({
        oldString: String(e.old_string ?? ""),
        newString: String(e.new_string ?? ""),
      }));
    }
    return [];
  }

  // Edit
  if (input.old_string !== undefined || input.new_string !== undefined) {
    return [{
      oldString: String(input.old_string ?? ""),
      newString: String(input.new_string ?? ""),
    }];
  }
  return [];
}

/** 인라인 diff 렌더링 (old → new) */
function InlineDiff({ oldString, newString }: EditPair) {
  const oldLines = oldString.split("\n");
  const newLines = newString.split("\n");

  return (
    <div className="font-mono text-xs leading-relaxed overflow-auto max-h-[300px] select-text">
      {oldLines.map((line, i) => (
        <div key={`old-${i}`} className="flex bg-destructive/8">
          <span className="w-6 shrink-0 text-center text-destructive/50 select-none font-semibold">
            -
          </span>
          <span className="flex-1 whitespace-pre-wrap break-all px-1.5 text-destructive/80">
            {line || "\u00A0"}
          </span>
        </div>
      ))}
      {newLines.map((line, i) => (
        <div key={`new-${i}`} className="flex bg-success/8">
          <span className="w-6 shrink-0 text-center text-success/50 select-none font-semibold">
            +
          </span>
          <span className="flex-1 whitespace-pre-wrap break-all px-1.5 text-success/80">
            {line || "\u00A0"}
          </span>
        </div>
      ))}
    </div>
  );
}

export const EditToolMessage = memo(function EditToolMessage({
  message,
}: EditToolMessageProps) {
  const [expanded, setExpanded] = useState(false);
  const toolName = message.tool || "Edit";
  const input = (message.input || {}) as Record<string, unknown>;
  const toolStatus = message.status || "running";
  const filePath = String(input.file_path ?? input.path ?? "");
  const isWrite = toolName === "Write";

  const borderColor =
    toolStatus === "error"
      ? "border-l-destructive"
      : toolStatus === "done"
        ? "border-l-success"
        : "border-l-info";

  const ToolIcon = getToolIcon(toolName);
  const toolColor = getToolColor(toolName);
  const elapsed = useElapsed(toolStatus, message.timestamp, message.completed_at);

  const edits = isWrite ? [] : extractEdits(message);

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
            {ToolIcon ? (
              <ToolIcon className={cn("h-3.5 w-3.5 shrink-0", toolColor)} />
            ) : null}
            <span className="font-mono text-xs font-semibold text-foreground">
              {toolName}
            </span>
            {filePath ? (
              <span className="font-mono text-xs text-muted-foreground flex-1 truncate">
                {filePath}
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
          <div className="mt-1.5 space-y-1.5">
            {/* Edit/MultiEdit: 인라인 diff */}
            {edits.length > 0 ? (
              <div className="rounded-md overflow-hidden border border-border/50 bg-input/40">
                {edits.map((edit, i) => (
                  <div key={i}>
                    {i > 0 ? (
                      <div className="border-t border-border/30 my-0" />
                    ) : null}
                    <InlineDiff oldString={edit.oldString} newString={edit.newString} />
                  </div>
                ))}
              </div>
            ) : null}

            {/* Write: content 미리보기 (너무 길면 truncate) */}
            {isWrite && input.content ? (
              <div>
                <div className="font-mono text-2xs text-muted-foreground/70 mb-0.5">
                  Content
                </div>
                <pre className="font-mono text-xs text-muted-foreground bg-input/80 p-2.5 rounded-md overflow-auto max-h-[200px] whitespace-pre-wrap select-text">
                  {String(input.content).length > 2000
                    ? `${String(input.content).slice(0, 2000)}\u2026`
                    : String(input.content)}
                </pre>
              </div>
            ) : null}

            {/* Output */}
            {message.output ? (
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-2xs text-muted-foreground/70">
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
                    "font-mono text-xs bg-input/80 p-2.5 rounded-md overflow-auto max-h-[200px] whitespace-pre-wrap select-text",
                    message.is_error
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {message.output}
                </pre>
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});
