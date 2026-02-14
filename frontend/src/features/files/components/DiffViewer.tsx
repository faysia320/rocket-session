import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";

interface DiffViewerProps {
  diff: string;
}

interface DiffLine {
  type: "add" | "remove" | "context" | "header" | "info";
  content: string;
  oldNum?: number;
  newNum?: number;
}

function parseDiff(diffText: string): DiffLine[] {
  const lines = diffText.split("\n");
  const result: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (
      line.startsWith("diff --git") ||
      line.startsWith("index ") ||
      line.startsWith("---") ||
      line.startsWith("+++")
    ) {
      result.push({ type: "info", content: line });
      continue;
    }
    if (line.startsWith("@@")) {
      // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      result.push({ type: "header", content: line });
      continue;
    }
    if (line.startsWith("+")) {
      result.push({ type: "add", content: line.slice(1), newNum: newLine });
      newLine++;
    } else if (line.startsWith("-")) {
      result.push({ type: "remove", content: line.slice(1), oldNum: oldLine });
      oldLine++;
    } else if (line.startsWith(" ")) {
      result.push({
        type: "context",
        content: line.slice(1),
        oldNum: oldLine,
        newNum: newLine,
      });
      oldLine++;
      newLine++;
    } else if (line === "") {
      // empty line at end
    } else {
      result.push({ type: "info", content: line });
    }
  }

  return result;
}

export const DiffViewer = memo(function DiffViewer({ diff }: DiffViewerProps) {
  const lines = useMemo(() => parseDiff(diff), [diff]);

  if (!diff.trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="font-mono text-xs text-muted-foreground">
          변경사항이 없습니다
        </div>
      </div>
    );
  }

  return (
    <div className="font-mono text-[11px] leading-[1.6] select-text">
      {lines.map((line, i) => {
        if (line.type === "info") {
          return (
            <div
              key={i}
              className="px-4 py-0.5 text-muted-foreground/70 bg-secondary/30 italic"
            >
              {line.content}
            </div>
          );
        }
        if (line.type === "header") {
          return (
            <div
              key={i}
              className="px-4 py-1 text-info bg-info/10 border-y border-border/30 font-semibold mt-2 first:mt-0"
            >
              {line.content}
            </div>
          );
        }
        return (
          <div
            key={i}
            className={cn(
              "flex",
              line.type === "add" && "bg-success/10",
              line.type === "remove" && "bg-destructive/10",
            )}
          >
            {/* Line numbers */}
            <span className="w-10 shrink-0 text-right pr-1 text-muted-foreground/50 select-none border-r border-border/20">
              {line.oldNum ?? ""}
            </span>
            <span className="w-10 shrink-0 text-right pr-1 text-muted-foreground/50 select-none border-r border-border/20">
              {line.newNum ?? ""}
            </span>
            {/* Indicator */}
            <span
              className={cn(
                "w-5 shrink-0 text-center select-none font-bold",
                line.type === "add" && "text-success",
                line.type === "remove" && "text-destructive",
              )}
            >
              {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
            </span>
            {/* Content */}
            <span
              className={cn(
                "flex-1 whitespace-pre-wrap break-all px-1",
                line.type === "add" && "text-success",
                line.type === "remove" && "text-destructive",
              )}
            >
              {line.content || "\u00A0"}
            </span>
          </div>
        );
      })}
    </div>
  );
});
