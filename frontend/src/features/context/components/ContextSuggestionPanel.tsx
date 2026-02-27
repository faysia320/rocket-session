import { memo, useState, useCallback, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, FileText, Clock, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useContextSuggestion } from "../hooks/useContextSuggestion";
import type { WorkspaceInsightInfo } from "@/types/knowledge";
import type { FileSuggestion, SessionSummary } from "@/lib/api/context.api";

interface ContextSuggestionPanelProps {
  workspaceId: string | null;
  prompt: string;
  onContextChange: (contextText: string) => void;
}

export const ContextSuggestionPanel = memo(function ContextSuggestionPanel({
  workspaceId,
  prompt,
  onContextChange,
}: ContextSuggestionPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedInsightIds, setSelectedInsightIds] = useState<Set<number>>(new Set());
  const [selectedFilePaths, setSelectedFilePaths] = useState<Set<string>>(new Set());
  const [debouncedPrompt, setDebouncedPrompt] = useState(prompt);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // 500ms debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedPrompt(prompt), 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [prompt]);

  const { data, isLoading } = useContextSuggestion(workspaceId, debouncedPrompt || undefined);

  // Auto-expand when workspace is selected
  useEffect(() => {
    if (workspaceId && data) setExpanded(true);
  }, [workspaceId, data]);

  // Build context text from selections
  const buildContextText = useCallback(() => {
    if (!data) return "";
    const parts: string[] = [];

    if (selectedInsightIds.size > 0) {
      const selected = data.insights.filter((i: WorkspaceInsightInfo) =>
        selectedInsightIds.has(i.id),
      );
      if (selected.length > 0) {
        parts.push("## Workspace Knowledge");
        for (const i of selected) {
          parts.push(`- **${i.title}** (${i.category}): ${i.content}`);
        }
      }
    }

    if (selectedFilePaths.size > 0) {
      const selected = data.suggested_files.filter((f: FileSuggestion) =>
        selectedFilePaths.has(f.file_path),
      );
      if (selected.length > 0) {
        parts.push("## Relevant Files");
        for (const f of selected) {
          parts.push(`- \`${f.file_path}\`: ${f.reason}`);
        }
      }
    }

    return parts.join("\n");
  }, [data, selectedInsightIds, selectedFilePaths]);

  // Notify parent when selection changes
  useEffect(() => {
    onContextChange(buildContextText());
  }, [buildContextText, onContextChange]);

  const toggleInsight = useCallback((id: number) => {
    setSelectedInsightIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleFile = useCallback((path: string) => {
    setSelectedFilePaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  if (!workspaceId) return null;

  return (
    <div className="border border-border rounded-md overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-mono text-xs font-medium text-muted-foreground">
          Context Suggestions
        </span>
        <div className="flex items-center gap-2">
          {data && (
            <Badge variant="secondary" className="font-mono text-2xs">
              {data.insights.length + data.suggested_files.length} items
            </Badge>
          )}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-3 space-y-4 max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-8 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : !data ? (
            <p className="font-mono text-2xs text-muted-foreground text-center py-4">
              No suggestions available
            </p>
          ) : (
            <>
              {/* Insights section */}
              {data.insights.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Lightbulb className="h-3 w-3 text-primary" />
                    <span className="font-mono text-2xs font-semibold text-muted-foreground">
                      WORKSPACE KNOWLEDGE
                    </span>
                  </div>
                  <div className="space-y-1">
                    {data.insights.map((insight: WorkspaceInsightInfo) => (
                      <label
                        key={insight.id}
                        className="flex items-start gap-2 px-2 py-1.5 rounded-sm hover:bg-muted/30 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedInsightIds.has(insight.id)}
                          onCheckedChange={() => toggleInsight(insight.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-xs text-foreground">{insight.title}</span>
                          <p className="font-mono text-2xs text-muted-foreground line-clamp-1">
                            {insight.content}
                          </p>
                        </div>
                        <Badge variant="secondary" className="font-mono text-2xs shrink-0">
                          {insight.category}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent sessions section */}
              {data.recent_sessions.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className="h-3 w-3 text-primary" />
                    <span className="font-mono text-2xs font-semibold text-muted-foreground">
                      RECENT SESSIONS
                    </span>
                  </div>
                  <div className="space-y-1">
                    {data.recent_sessions.slice(0, 3).map((s: SessionSummary) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-sm bg-muted/20"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-xs text-foreground">
                            {s.name || s.id.slice(0, 8)}
                          </span>
                          {s.prompt_preview && (
                            <p className="font-mono text-2xs text-muted-foreground line-clamp-1">
                              {s.prompt_preview}
                            </p>
                          )}
                        </div>
                        <span className="font-mono text-2xs text-muted-foreground/50 shrink-0">
                          {s.file_count} files
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested files section */}
              {data.suggested_files.length > 0 && (
                <div>
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
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-2xs text-foreground truncate block">
                            {f.file_path}
                          </span>
                          <span className="font-mono text-2xs text-muted-foreground">
                            {f.reason}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});
