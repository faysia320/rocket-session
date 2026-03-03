import { memo, useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Brain,
  AlertTriangle,
  RefreshCw,
  Check,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useContextSuggestion } from "../hooks/useContextSuggestion";
import type { MemoryFileInfo } from "@/types/claude-memory";
import type { FileSuggestion, SessionSummary } from "@/lib/api/context.api";

interface ContextSuggestionPanelProps {
  workspaceId: string | null;
  prompt: string;
  onContextChange: (contextText: string) => void;
  /** U6: 세션 클릭 시 해당 세션으로 이동 */
  onSessionClick?: (sessionId: string) => void;
}

export const ContextSuggestionPanel = memo(function ContextSuggestionPanel({
  workspaceId,
  prompt,
  onContextChange,
  onSessionClick,
}: ContextSuggestionPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedFilePaths, setSelectedFilePaths] = useState<Set<string>>(new Set());
  const [debouncedPrompt, setDebouncedPrompt] = useState(prompt);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevContextTextRef = useRef("");

  // 500ms debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedPrompt(prompt), 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [prompt]);

  // S3: isError, error, refetch 추출
  const { data, isLoading, isError, refetch } = useContextSuggestion(
    workspaceId,
    debouncedPrompt || undefined,
  );

  const hasContent = data
    ? data.memory_files.length > 0 || data.suggested_files.length > 0 || data.recent_sessions.length > 0
    : false;

  // P4: buildContextText를 useMemo로 변경 — 함수 재생성 방지
  const contextText = useMemo(() => {
    if (!data) return "";
    if (selectedFilePaths.size === 0) return "";

    const selected = data.suggested_files.filter((f: FileSuggestion) =>
      selectedFilePaths.has(f.file_path),
    );
    if (selected.length === 0) return "";

    const parts: string[] = ["## Relevant Files"];
    for (const f of selected) {
      parts.push(`- \`${f.file_path}\`: ${f.reason}`);
    }
    return parts.join("\n");
  }, [data, selectedFilePaths]);

  // Notify parent only when context text actually changes
  useEffect(() => {
    if (contextText !== prevContextTextRef.current) {
      prevContextTextRef.current = contextText;
      onContextChange(contextText);
    }
  }, [contextText, onContextChange]);

  const toggleFile = useCallback((path: string) => {
    setSelectedFilePaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // U5: 선택된 파일 개수 (전송 시 포함될 컨텍스트 표시)
  const selectedCount = selectedFilePaths.size;

  if (!workspaceId) return null;

  const sourceLabel = (source: string) => {
    switch (source) {
      case "auto_memory": return "Auto";
      case "claude_md": return "Project";
      case "rules": return "Rules";
      case "serena_memory": return "Serena";
      default: return source;
    }
  };

  // U7: score를 퍼센트 바로 시각화
  const maxScore = data?.suggested_files.length
    ? Math.max(...data.suggested_files.map((f: FileSuggestion) => f.score), 0.01)
    : 1;

  const totalItems = data
    ? data.memory_files.length + data.suggested_files.length
    : 0;

  return (
    <div className="border border-border rounded-md overflow-hidden" role="region" aria-label="컨텍스트 제안">
      {/* Toggle header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls="context-suggestions-content"
      >
        <span className="font-mono text-xs font-medium text-muted-foreground">
          Context Suggestions
        </span>
        <div className="flex items-center gap-2">
          {/* U5: 선택된 파일 수 표시 */}
          {selectedCount > 0 ? (
            <Badge variant="default" className="font-mono text-2xs gap-1">
              <Check className="h-2.5 w-2.5" />
              {selectedCount} selected
            </Badge>
          ) : null}
          {isError ? (
            <Badge variant="destructive" className="font-mono text-2xs">
              오류
            </Badge>
          ) : data ? (
            <Badge variant="secondary" className="font-mono text-2xs">
              {totalItems} items
            </Badge>
          ) : null}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded ? (
        <ScrollArea className="max-h-[300px]">
        <div id="context-suggestions-content" className="p-3 space-y-4">
          {/* S3+U1: 에러 상태 표시 + 재시도 */}
          {isError ? (
            <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs text-destructive">
                  컨텍스트 제안을 불러올 수 없습니다
                </p>
                <p className="font-mono text-2xs text-muted-foreground">
                  서버 연결을 확인하거나 다시 시도해주세요
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); refetch(); }}
                className="shrink-0 px-2 py-1 rounded text-xs font-mono text-primary hover:bg-primary/10 transition-colors flex items-center gap-1"
                aria-label="컨텍스트 제안 다시 불러오기"
              >
                <RefreshCw className="h-3 w-3" />
                재시도
              </button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2" role="status" aria-label="로딩 중">
              {[1, 2].map((i) => (
                <div key={i} className="h-8 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : !data || !hasContent ? (
            <p className="font-mono text-2xs text-muted-foreground text-center py-4">
              컨텍스트 제안이 없습니다
            </p>
          ) : (
            <>
              {/* Memory files section — 읽기 전용 (백엔드 자동 주입) */}
              {data.memory_files.length > 0 ? (
                <div role="group" aria-label="Claude Code Memory">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Brain className="h-3 w-3 text-primary" />
                    <span className="font-mono text-2xs font-semibold text-muted-foreground">
                      CLAUDE CODE MEMORY
                    </span>
                    {/* U3: Auto-injected 툴팁 */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="font-mono text-2xs ml-auto cursor-help">
                          Auto-injected
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[280px]">
                        <p className="text-xs">
                          이 파일들은 세션 시작 시 system_prompt에 자동으로 주입됩니다.
                          별도 선택 없이 Claude가 항상 참조합니다.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="space-y-1">
                    {data.memory_files.map((mf: MemoryFileInfo) => (
                      <div
                        key={mf.relative_path}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-sm bg-muted/20"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-xs text-foreground">{mf.name}</span>
                          <p className="font-mono text-2xs text-muted-foreground">
                            {(mf.size_bytes / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <Badge variant="secondary" className="font-mono text-2xs shrink-0">
                          {sourceLabel(mf.source)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Recent sessions section */}
              {data.recent_sessions.length > 0 ? (
                <div role="group" aria-label="최근 세션">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className="h-3 w-3 text-primary" />
                    <span className="font-mono text-2xs font-semibold text-muted-foreground">
                      RECENT SESSIONS
                    </span>
                  </div>
                  <div className="space-y-1">
                    {data.recent_sessions.slice(0, 3).map((s: SessionSummary) => (
                      // U6: 세션 클릭 시 이동 가능
                      <button
                        type="button"
                        key={s.id}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                        onClick={() => onSessionClick?.(s.id)}
                        aria-label={`세션: ${s.name || s.id.slice(0, 8)}`}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-xs text-foreground">
                            {s.name || s.id.slice(0, 8)}
                          </span>
                          {s.prompt_preview ? (
                            <p className="font-mono text-2xs text-muted-foreground line-clamp-1">
                              {s.prompt_preview}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono text-2xs text-muted-foreground/50">
                            {s.file_count} files
                          </span>
                          {onSessionClick ? (
                            <ExternalLink className="h-3 w-3 text-muted-foreground/30" />
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Suggested files section */}
              {data.suggested_files.length > 0 ? (
                <div role="group" aria-label="제안 파일">
                  <div className="flex items-center gap-1.5 mb-2">
                    <FileText className="h-3 w-3 text-primary" />
                    <span className="font-mono text-2xs font-semibold text-muted-foreground">
                      SUGGESTED FILES
                    </span>
                  </div>
                  <div className="space-y-1">
                    {data.suggested_files.slice(0, 5).map((f: FileSuggestion) => (
                      <label
                        key={f.file_path}
                        className="flex items-start gap-2 px-2 py-1.5 rounded-sm hover:bg-muted/30 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedFilePaths.has(f.file_path)}
                          onCheckedChange={() => toggleFile(f.file_path)}
                          className="mt-0.5"
                          aria-label={`파일 선택: ${f.file_path}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-2xs text-foreground truncate block flex-1">
                              {f.file_path}
                            </span>
                            {/* U7: score 시각화 */}
                            <div className="shrink-0 flex items-center gap-1">
                              <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary/60"
                                  style={{ width: `${Math.round((f.score / maxScore) * 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <span className="font-mono text-2xs text-muted-foreground">
                            {f.reason}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
        </ScrollArea>
      ) : null}
    </div>
  );
});
