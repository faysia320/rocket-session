import { useState, memo, useMemo } from "react";
import { Search, ChevronRight, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ToolUseMsg } from "@/types";
import { ToolStatusIcon } from "./ToolStatusIcon";
import { useElapsed } from "./toolMessageUtils";

interface SearchToolMessageProps {
  message: ToolUseMsg;
}

/** Grep 출력을 파일별로 그룹화하여 파싱 */
function parseGrepOutput(output: string): { file: string; lines: string[] }[] {
  const groups: { file: string; lines: string[] }[] = [];
  let current: { file: string; lines: string[] } | null = null;

  for (const line of output.split("\n")) {
    // ripgrep 스타일: "file:line:content" 또는 "file-line-content"
    const match = line.match(/^(.+?):(\d+)[:|-](.*)$/);
    if (match) {
      const [, file] = match;
      if (!current || current.file !== file) {
        current = { file, lines: [] };
        groups.push(current);
      }
      current.lines.push(line);
    } else if (line.trim()) {
      // 파일 헤더나 구분자가 아닌 일반 라인
      if (current) {
        current.lines.push(line);
      } else {
        current = { file: "", lines: [line] };
        groups.push(current);
      }
    }
  }
  return groups;
}

/** Glob 출력을 트리 형태로 정리 */
function parseGlobOutput(output: string): string[] {
  return output.split("\n").filter((line) => line.trim());
}

export const SearchToolMessage = memo(function SearchToolMessage({
  message,
}: SearchToolMessageProps) {
  const [expanded, setExpanded] = useState(false);
  const toolName = message.tool || "Search";
  const input = (message.input || {}) as Record<string, unknown>;
  const toolStatus = message.status || "running";
  const isGrep = toolName === "Grep";

  const borderColor =
    toolStatus === "error"
      ? "border-l-destructive"
      : toolStatus === "done"
        ? "border-l-success"
        : "border-l-info";

  const elapsed = useElapsed(toolStatus, message.timestamp, message.completed_at);

  const pattern = String(input.pattern ?? input.q ?? "");
  const searchPath = String(input.path ?? input.glob ?? "");
  const headerText = [
    pattern ? `"${pattern}"` : null,
    searchPath ? `in ${searchPath}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const parsedOutput = useMemo(() => {
    if (!message.output) return null;
    if (isGrep) return parseGrepOutput(message.output);
    return null;
  }, [message.output, isGrep]);

  const globFiles = useMemo(() => {
    if (!message.output || isGrep) return null;
    return parseGlobOutput(message.output);
  }, [message.output, isGrep]);

  const resultCount = isGrep
    ? (parsedOutput?.reduce((sum, g) => sum + g.lines.length, 0) ?? 0)
    : (globFiles?.length ?? 0);

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
            <Search className="h-3.5 w-3.5 shrink-0 text-info" />
            <span className="font-mono text-xs font-semibold text-foreground">
              {toolName}
            </span>
            <span className="font-mono text-xs text-muted-foreground flex-1 truncate">
              {headerText}
            </span>
            {toolStatus === "done" && resultCount > 0 ? (
              <span className="font-mono text-2xs px-1.5 py-0.5 rounded bg-info/10 text-info border border-info/20 shrink-0">
                {resultCount} {isGrep ? "matches" : "files"}
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
            {/* Grep: 파일별 그룹화 출력 */}
            {isGrep && parsedOutput && parsedOutput.length > 0 ? (
              <div className="space-y-1">
                {parsedOutput.map((group, gi) => (
                  <div key={gi}>
                    {group.file ? (
                      <div className="font-mono text-2xs text-info/80 px-2.5 pt-1.5 pb-0.5 font-semibold">
                        {group.file}
                      </div>
                    ) : null}
                    <pre className="font-mono text-xs text-muted-foreground bg-input/80 px-2.5 py-1.5 rounded-md overflow-auto max-h-[200px] whitespace-pre-wrap select-text">
                      {group.lines.join("\n")}
                    </pre>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Glob: 파일 목록 */}
            {!isGrep && globFiles && globFiles.length > 0 ? (
              <div className="bg-input/80 rounded-md p-2.5 overflow-auto max-h-[300px]">
                {globFiles.map((file, i) => (
                  <div
                    key={i}
                    className="font-mono text-xs text-muted-foreground py-0.5 select-text"
                  >
                    {file}
                  </div>
                ))}
              </div>
            ) : null}

            {/* 파싱 실패 시 raw output */}
            {message.output && !parsedOutput?.length && !globFiles?.length ? (
              <pre className="font-mono text-xs text-muted-foreground bg-input/80 p-2.5 rounded-md overflow-auto max-h-[300px] whitespace-pre-wrap select-text">
                {message.output}
              </pre>
            ) : null}

            {!message.output && toolStatus === "running" ? (
              <div className="font-mono text-2xs text-muted-foreground/50 italic py-2">
                검색 중{"\u2026"}
              </div>
            ) : null}

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
