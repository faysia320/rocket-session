import { useState, useMemo, useCallback, useEffect } from "react";
import { Plus, Brain, FileText, BookOpen, Database, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useInsights,
  useCreateInsight,
  useUpdateInsight,
  useDeleteInsight,
  useArchiveInsights,
} from "../hooks/useInsights";
import { useMemoryFiles, useMemoryFileContent } from "../hooks/useMemory";
import { InsightCard } from "./InsightCard";
import { InsightCreateDialog } from "./InsightCreateDialog";
import type {
  InsightCategory,
  CreateInsightRequest,
  WorkspaceInsightInfo,
} from "@/types/knowledge";
import type { MemoryFileInfo, MemorySource } from "@/types/claude-memory";

type MainTab = "memory" | "insights";

const MEMORY_SOURCE_CHIPS: { value: MemorySource; label: string }[] = [
  { value: "auto_memory", label: "Auto" },
  { value: "claude_md", label: "Project" },
  { value: "rules", label: "Rules" },
  { value: "serena_memory", label: "Serena" },
];

const CATEGORY_TABS: { value: InsightCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pattern", label: "Pattern" },
  { value: "gotcha", label: "Gotcha" },
  { value: "decision", label: "Decision" },
  { value: "file_map", label: "File Map" },
  { value: "dependency", label: "Dependency" },
];

const SOURCE_LABELS: Record<string, string> = {
  auto_memory: "Auto Memory",
  claude_md: "Project Guide",
  rules: "Rules",
  serena_memory: "Serena Memory",
};

const SOURCE_ICONS: Record<string, typeof Brain> = {
  auto_memory: Brain,
  claude_md: BookOpen,
  rules: FileText,
  serena_memory: Database,
};

const BADGE_SHORT: Record<string, string> = {
  auto_memory: "Auto",
  claude_md: "Project",
  rules: "Rules",
  serena_memory: "Serena",
};

interface KnowledgeContentProps {
  workspaceId: string;
}

export function KnowledgeContent({ workspaceId }: KnowledgeContentProps) {
  const [mainTab, setMainTab] = useState<MainTab>("memory");
  const [categoryFilter, setCategoryFilter] = useState<InsightCategory | "all">("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingInsight, setEditingInsight] = useState<WorkspaceInsightInfo | null>(null);
  const [selectedMemoryFile, setSelectedMemoryFile] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [memorySourceFilter, setMemorySourceFilter] = useState<Set<MemorySource>>(new Set());

  // 워크스페이스 전환 시 상태 리셋
  useEffect(() => {
    setSelectedMemoryFile(null);
    setSearchQuery("");
    setMemorySourceFilter(new Set());
  }, [workspaceId]);

  // Insights hooks
  const { data: insights, isLoading: insightsLoading } = useInsights(
    mainTab === "insights" ? workspaceId : null,
    categoryFilter === "all" ? undefined : categoryFilter,
  );
  const createMutation = useCreateInsight(workspaceId);
  const updateMutation = useUpdateInsight(workspaceId);
  const deleteMutation = useDeleteInsight(workspaceId);
  const archiveMutation = useArchiveInsights(workspaceId);

  // Memory hooks
  const { data: memoryFiles, isLoading: memoryLoading } = useMemoryFiles(
    mainTab === "memory" ? workspaceId : null,
  );
  const { data: memoryContent, isLoading: contentLoading } = useMemoryFileContent(
    workspaceId,
    selectedMemoryFile,
  );

  const filteredInsights = useMemo(() => {
    if (!insights) return [];
    if (!searchQuery.trim()) return insights;
    const q = searchQuery.toLowerCase();
    return insights.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.content.toLowerCase().includes(q) ||
        i.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [insights, searchQuery]);

  const filteredMemoryFiles = useMemo(() => {
    if (!memoryFiles) return [];
    let result = memoryFiles;
    if (memorySourceFilter.size > 0) {
      result = result.filter((f) => memorySourceFilter.has(f.source));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(q));
    }
    return result;
  }, [memoryFiles, memorySourceFilter, searchQuery]);

  const handleCreate = useCallback(
    (data: CreateInsightRequest) => {
      if (editingInsight) {
        updateMutation.mutate(
          { insightId: editingInsight.id, data },
          { onSuccess: () => setEditingInsight(null) },
        );
      } else {
        createMutation.mutate(data);
      }
    },
    [editingInsight, createMutation, updateMutation],
  );

  const handleEdit = useCallback((insight: WorkspaceInsightInfo) => {
    setEditingInsight(insight);
    setCreateDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    (id: number) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  const handleArchive = useCallback(
    (id: number) => {
      archiveMutation.mutate([id]);
    },
    [archiveMutation],
  );

  const toggleSourceFilter = useCallback((source: MemorySource) => {
    setMemorySourceFilter((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* 헤더 바: 탭 + 액션 */}
      <div className="shrink-0 px-4 py-2 border-b border-border flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          <button
            type="button"
            className={cn(
              "font-mono text-xs px-4 py-1.5 rounded-sm border transition-colors flex items-center gap-1.5",
              mainTab === "memory"
                ? "bg-primary/15 text-primary border-primary/30"
                : "text-muted-foreground border-transparent hover:bg-muted",
            )}
            onClick={() => {
              setMainTab("memory");
              setSelectedMemoryFile(null);
            }}
          >
            <Brain className="h-3 w-3" />
            Memory
            {mainTab === "memory" && memoryFiles ? (
              <Badge variant="secondary" className="font-mono text-2xs ml-1 px-1 py-0">
                {memoryFiles.length}
              </Badge>
            ) : null}
          </button>
          <button
            type="button"
            className={cn(
              "font-mono text-xs px-4 py-1.5 rounded-sm border transition-colors flex items-center gap-1.5",
              mainTab === "insights"
                ? "bg-primary/15 text-primary border-primary/30"
                : "text-muted-foreground border-transparent hover:bg-muted",
            )}
            onClick={() => setMainTab("insights")}
          >
            <BookOpen className="h-3 w-3" />
            Insights
            {mainTab === "insights" && insights ? (
              <Badge variant="secondary" className="font-mono text-2xs ml-1 px-1 py-0">
                {filteredInsights.length}
              </Badge>
            ) : null}
          </button>
        </div>
        {mainTab === "insights" && (
          <Button
            variant="default"
            size="sm"
            className="font-mono text-xs gap-1.5"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New Insight
          </Button>
        )}
      </div>

      {/* Category filter (insights only) */}
      {mainTab === "insights" && (
        <div className="shrink-0 px-4 py-2 border-b border-border">
          <div className="flex gap-1">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={cn(
                  "font-mono text-2xs px-3 py-1 rounded-sm border transition-colors",
                  categoryFilter === tab.value
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "text-muted-foreground border-transparent hover:bg-muted",
                )}
                onClick={() => setCategoryFilter(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search bar + Memory source filter */}
      <div className="shrink-0 px-4 py-2 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="font-mono text-xs pl-8 h-8"
            placeholder={mainTab === "memory" ? "Search files..." : "Search insights..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {mainTab === "memory" && memoryFiles && memoryFiles.length > 0 ? (
          <div className="flex gap-1">
            {MEMORY_SOURCE_CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                className={cn(
                  "font-mono text-2xs px-2.5 py-0.5 rounded-sm border transition-colors",
                  memorySourceFilter.has(chip.value)
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "text-muted-foreground border-transparent hover:bg-muted",
                )}
                onClick={() => toggleSourceFilter(chip.value)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3">
          {mainTab === "memory" ? (
            /* Memory tab content */
            memoryLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded-md animate-pulse" />
                ))}
              </div>
            ) : !memoryFiles || memoryFiles.length === 0 ? (
              <div className="py-12 text-center font-mono text-xs text-muted-foreground">
                No Claude Code Memory files found for this workspace.
              </div>
            ) : selectedMemoryFile && memoryContent ? (
              /* Memory file content view */
              <div>
                <button
                  type="button"
                  className="font-mono text-2xs text-primary hover:underline mb-3 block"
                  onClick={() => setSelectedMemoryFile(null)}
                >
                  &larr; Back to file list
                </button>
                <div className="rounded-md border border-border">
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
                    <Badge variant="secondary" className="font-mono text-2xs">
                      {SOURCE_LABELS[memoryContent.source] ?? memoryContent.source}
                    </Badge>
                    <span className="font-mono text-xs font-medium">{memoryContent.name}</span>
                  </div>
                  <div className="p-4">
                    <pre className="font-mono text-xs whitespace-pre-wrap text-foreground/90 leading-relaxed">
                      {memoryContent.content}
                    </pre>
                  </div>
                </div>
              </div>
            ) : contentLoading ? (
              <div className="h-48 bg-muted rounded-md animate-pulse" />
            ) : filteredMemoryFiles.length === 0 ? (
              <div className="py-12 text-center font-mono text-xs text-muted-foreground">
                No matching files.
              </div>
            ) : (
              /* Memory file list */
              filteredMemoryFiles.map((mf: MemoryFileInfo) => {
                const Icon = SOURCE_ICONS[mf.source] ?? FileText;
                return (
                  <button
                    key={mf.relative_path}
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-md border border-border hover:bg-muted/30 transition-colors text-left"
                    onClick={() => setSelectedMemoryFile(mf.relative_path)}
                  >
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-xs font-medium text-foreground block">
                        {mf.name}
                      </span>
                      <span className="font-mono text-2xs text-muted-foreground">
                        {SOURCE_LABELS[mf.source] ?? mf.source} &middot;{" "}
                        {(mf.size_bytes / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <Badge variant="outline" className="font-mono text-2xs shrink-0">
                      {BADGE_SHORT[mf.source] ?? mf.source}
                    </Badge>
                  </button>
                );
              })
            )
          ) : /* Insights tab content */
          insightsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted rounded-md animate-pulse" />
              ))}
            </div>
          ) : filteredInsights.length === 0 ? (
            <div className="py-12 text-center font-mono text-xs text-muted-foreground">
              No insights found. Create one manually.
            </div>
          ) : (
            filteredInsights.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onEdit={handleEdit}
                onArchive={handleArchive}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Create / Edit dialog */}
      <InsightCreateDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setEditingInsight(null);
        }}
        onSubmit={handleCreate}
        isPending={createMutation.isPending || updateMutation.isPending}
        initialData={editingInsight}
      />
    </div>
  );
}
