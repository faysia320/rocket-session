import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Download,
  Loader2,
  GitBranch,
  MessageSquare,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { localSessionsApi } from "@/lib/api/local-sessions.api";
import type { LocalSessionMeta } from "@/types";
import { useVirtualizer } from "@tanstack/react-virtual";

interface ImportLocalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (dashboardSessionId: string) => void;
}

type FlatItem =
  | { type: "group-header"; cwd: string; count: number }
  | { type: "session"; meta: LocalSessionMeta };

function getYesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function ImportLocalDialog({
  open,
  onOpenChange,
  onImported,
}: ImportLocalDialogProps) {
  const [sessions, setSessions] = useState<LocalSessionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hideImported, setHideImported] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    localSessionsApi
      .scan({ since: getYesterdayISO() })
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open]);

  const handleImport = async (meta: LocalSessionMeta) => {
    setImporting(meta.session_id);
    try {
      const result = await localSessionsApi.import({
        session_id: meta.session_id,
        project_dir: meta.project_dir,
      });
      setSessions((prev) =>
        prev.map((s) =>
          s.session_id === meta.session_id
            ? { ...s, already_imported: true }
            : s,
        ),
      );
      onImported(result.dashboard_session_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import fail");
    } finally {
      setImporting(null);
    }
  };

  const filtered = useMemo(() => {
    const base = hideImported
      ? sessions.filter((s) => !s.already_imported)
      : sessions;
    return base.reduce<Record<string, LocalSessionMeta[]>>((acc, s) => {
      const key = s.cwd || s.project_dir;
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {});
  }, [sessions, hideImported]);

  const toggleGroup = useCallback((cwd: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(cwd)) {
        next.delete(cwd);
      } else {
        next.add(cwd);
      }
      return next;
    });
  }, []);

  const allGroupKeys = useMemo(() => Object.keys(filtered), [filtered]);

  const allCollapsed =
    allGroupKeys.length > 0 &&
    allGroupKeys.every((k) => collapsedGroups.has(k));

  const toggleAll = useCallback(() => {
    if (allCollapsed) {
      setCollapsedGroups(new Set());
    } else {
      setCollapsedGroups(new Set(allGroupKeys));
    }
  }, [allCollapsed, allGroupKeys]);

  const flatItems = useMemo(() => {
    const result: FlatItem[] = [];
    for (const [cwd, items] of Object.entries(filtered)) {
      result.push({ type: "group-header", cwd, count: items.length });
      if (!collapsedGroups.has(cwd)) {
        for (const s of items) {
          result.push({ type: "session", meta: s });
        }
      }
    }
    return result;
  }, [filtered, collapsedGroups]);

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (flatItems[i].type === "group-header" ? 36 : 56),
    overscan: 10,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm flex items-center gap-2">
            <Download className="h-4 w-4" />
            Import Local Sessions
          </DialogTitle>
          <DialogDescription className="sr-only">
            Scan and import local Claude sessions from your project directories
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-8 text-center font-mono text-xs text-destructive">
            {error}
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-8 text-center font-mono text-xs text-muted-foreground">
            No local sessions found
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 py-2 border-b border-border">
              <Checkbox
                id="hide-imported"
                checked={hideImported}
                onCheckedChange={(checked) => setHideImported(checked === true)}
              />
              <Label
                htmlFor="hide-imported"
                className="font-mono text-xs text-foreground cursor-pointer"
              >
                Import된 세션 숨기기
              </Label>
              {allGroupKeys.length > 1 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 ml-auto font-mono text-2xs text-muted-foreground"
                  onClick={toggleAll}
                  aria-label={allCollapsed ? "모두 펼치기" : "모두 접기"}
                >
                  <ChevronsUpDown className="h-3 w-3 mr-0.5" />
                  {allCollapsed ? "모두 펼치기" : "모두 접기"}
                </Button>
              ) : null}
            </div>
            <div ref={parentRef} className="flex-1 -mx-6 px-6 overflow-auto">
              <div
                className="relative"
                style={{ height: `${virtualizer.getTotalSize()}px` }}
              >
                {virtualizer.getVirtualItems().map((vItem) => {
                  const item = flatItems[vItem.index];
                  return (
                    <div
                      key={vItem.key}
                      className="absolute top-0 left-0 w-full"
                      style={{
                        transform: `translateY(${vItem.start}px)`,
                      }}
                    >
                      {item.type === "group-header" ? (
                        <button
                          type="button"
                          className="flex items-center gap-1.5 mb-2 h-9 w-full text-left hover:bg-muted/50 rounded-sm px-1 -mx-1 transition-colors"
                          onClick={() => toggleGroup(item.cwd)}
                          aria-expanded={!collapsedGroups.has(item.cwd)}
                          aria-label={`${truncateCwd(item.cwd)} 그룹 ${collapsedGroups.has(item.cwd) ? "펼치기" : "접기"}`}
                        >
                          {collapsedGroups.has(item.cwd) ? (
                            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                          <FolderOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span
                            className="font-mono text-2xs text-muted-foreground truncate"
                            title={item.cwd}
                          >
                            {truncateCwd(item.cwd)}
                          </span>
                          <Badge
                            variant="secondary"
                            className="font-mono text-[9px] ml-auto"
                          >
                            {item.count}
                          </Badge>
                        </button>
                      ) : (
                        <div className="mb-1">
                          <SessionRow
                            meta={item.meta}
                            importing={importing === item.meta.session_id}
                            onImport={() => handleImport(item.meta)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SessionRow({
  meta,
  importing,
  onImport,
}: {
  meta: LocalSessionMeta;
  importing: boolean;
  onImport: () => void;
}) {
  const displayName = meta.slug || meta.session_id.slice(0, 8);
  const date = meta.last_timestamp
    ? new Date(meta.last_timestamp).toLocaleDateString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2.5 py-2 rounded-sm border border-border bg-card/50",
        meta.already_imported && "opacity-60",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-medium text-foreground truncate">
            {displayName}
          </span>
          {meta.already_imported ? (
            <Badge
              variant="secondary"
              className="font-mono text-[9px] shrink-0"
            >
              Imported
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {meta.git_branch ? (
            <span className="flex items-center gap-0.5 font-mono text-[9px] text-muted-foreground">
              <GitBranch className="h-2.5 w-2.5" />
              {meta.git_branch}
            </span>
          ) : null}
          <span className="flex items-center gap-0.5 font-mono text-[9px] text-muted-foreground">
            <MessageSquare className="h-2.5 w-2.5" />
            {meta.message_count}
          </span>
          {date ? (
            <span className="font-mono text-[9px] text-muted-foreground">
              {date}
            </span>
          ) : null}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 font-mono text-2xs shrink-0"
        disabled={meta.already_imported || importing}
        onClick={onImport}
        aria-label={`${displayName} import`}
      >
        {importing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : meta.already_imported ? (
          "Done"
        ) : (
          "Import"
        )}
      </Button>
    </div>
  );
}

function truncateCwd(p: string): string {
  if (!p) return "~";
  const parts = p.split(/[/\\]/);
  if (parts.length <= 3) return p;
  return "~/" + parts.slice(-2).join("/");
}
