import { memo, useState, useMemo, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/features/workspace/hooks/useWorkspaces";
import {
  useInsights,
  useCreateInsight,
  useDeleteInsight,
  useArchiveInsights,
} from "../hooks/useInsights";
import { InsightCard } from "./InsightCard";
import { InsightCreateDialog } from "./InsightCreateDialog";
import type { InsightCategory, CreateInsightRequest } from "@/types/knowledge";

const CATEGORY_TABS: { value: InsightCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pattern", label: "Pattern" },
  { value: "gotcha", label: "Gotcha" },
  { value: "decision", label: "Decision" },
  { value: "file_map", label: "File Map" },
  { value: "dependency", label: "Dependency" },
];

export const KnowledgeBasePanel = memo(function KnowledgeBasePanel() {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<InsightCategory | "all">("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: workspaces } = useWorkspaces();
  const { data: insights, isLoading } = useInsights(
    selectedWorkspaceId,
    categoryFilter === "all" ? undefined : categoryFilter,
  );
  const createMutation = useCreateInsight(selectedWorkspaceId ?? "");
  const deleteMutation = useDeleteInsight(selectedWorkspaceId ?? "");
  const archiveMutation = useArchiveInsights(selectedWorkspaceId ?? "");

  // Auto-select first workspace if none selected
  const effectiveWorkspaceId = selectedWorkspaceId ?? workspaces?.[0]?.id ?? null;

  const filteredInsights = useMemo(() => {
    if (!insights) return [];
    return insights;
  }, [insights]);

  const handleCreate = useCallback(
    (data: CreateInsightRequest) => {
      if (!effectiveWorkspaceId) return;
      createMutation.mutate(data);
    },
    [effectiveWorkspaceId, createMutation],
  );

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-mono text-lg font-bold">Knowledge Base</h1>
          <Button
            variant="default"
            size="sm"
            className="font-mono text-xs gap-1.5"
            onClick={() => setCreateDialogOpen(true)}
            disabled={!effectiveWorkspaceId}
          >
            <Plus className="h-3.5 w-3.5" />
            New Insight
          </Button>
        </div>

        {/* Workspace selector */}
        <div className="flex items-center gap-3">
          <Select
            value={effectiveWorkspaceId ?? ""}
            onValueChange={(v) => setSelectedWorkspaceId(v)}
          >
            <SelectTrigger className="w-[240px] font-mono text-xs">
              <SelectValue placeholder="Select workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces?.map((ws) => (
                <SelectItem key={ws.id} value={ws.id} className="font-mono text-xs">
                  {ws.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {insights && (
            <Badge variant="secondary" className="font-mono text-2xs">
              {filteredInsights.length} insights
            </Badge>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="px-6 py-2 border-b border-border">
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

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6 space-y-3">
          {!effectiveWorkspaceId ? (
            <div className="py-12 text-center font-mono text-xs text-muted-foreground">
              Select a workspace to view insights
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted rounded-md animate-pulse" />
              ))}
            </div>
          ) : filteredInsights.length === 0 ? (
            <div className="py-12 text-center font-mono text-xs text-muted-foreground">
              No insights found. Create one or extract from a session.
            </div>
          ) : (
            filteredInsights.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onArchive={handleArchive}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Create dialog */}
      <InsightCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreate}
        isPending={createMutation.isPending}
      />
    </div>
  );
});
