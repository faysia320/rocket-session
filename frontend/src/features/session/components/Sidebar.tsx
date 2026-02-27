import { useState, useRef, useCallback, useMemo, useEffect, memo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  Columns2,
  Download,
  FileSearch,
  GitFork,
  LayoutGrid,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  X,
  ChevronDown as ChevronDownIcon,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn, formatWorkDir } from "@/lib/utils";
import type { SessionInfo } from "@/types";
import { ImportLocalDialog } from "./ImportLocalDialog";
import { useSessionStore } from "@/store";
import { useSessionSearch } from "@/features/history/hooks/useSessionSearch";
import { useWorkspaces } from "@/features/workspace/hooks/useWorkspaces";

interface SidebarProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onImported?: (id: string) => void;
  isMobileOverlay?: boolean;
  isLoading?: boolean;
  isError?: boolean;
}

export const Sidebar = memo(function Sidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onDelete,
  onArchive,
  onRename,
  onImported,
  isMobileOverlay,
  isLoading,
  isError,
}: SidebarProps) {
  const navigate = useNavigate();
  const viewMode = useSessionStore((s) => s.viewMode);
  const setViewMode = useSessionStore((s) => s.setViewMode);
  const sidebarCollapsed = useSessionStore((s) => s.sidebarCollapsed);
  const collapsed = isMobileOverlay ? false : sidebarCollapsed;
  const toggleSidebar = useSessionStore((s) => s.toggleSidebar);
  const [importOpen, setImportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [ftsMode, setFtsMode] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "running" | "idle" | "error" | "archived"
  >("all");

  // Debounce for FTS search
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      setDebouncedQuery(value);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // FTS search params
  const ftsSearchParams = useMemo(
    () => ({
      fts: ftsMode && debouncedQuery ? debouncedQuery : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      sort: "created_at",
      order: "desc" as const,
      limit: 100,
      offset: 0,
    }),
    [debouncedQuery, ftsMode, statusFilter],
  );

  const { data: ftsData } = useSessionSearch({
    ...ftsSearchParams,
    fts: ftsSearchParams.fts,
  });

  // Workspace data for grouping
  const { data: workspaces } = useWorkspaces();

  const workspaceMap = useMemo(() => {
    const map = new Map<string, string>();
    if (workspaces) {
      for (const ws of workspaces) {
        map.set(ws.id, ws.name);
      }
    }
    return map;
  }, [workspaces]);

  // Non-archived total count (for badge)
  const nonArchivedTotal = useMemo(
    () => sessions.filter((s) => s.status !== "archived").length,
    [sessions],
  );

  // Filtered sessions - either FTS results or local filter
  const filteredSessions = useMemo(() => {
    // FTS mode: use server-side search results
    if (ftsMode && debouncedQuery && ftsData?.items) {
      let filtered = ftsData.items;
      if (statusFilter === "all") {
        filtered = filtered.filter((s) => s.status !== "archived");
      } else {
        filtered = filtered.filter((s) => s.status === statusFilter);
      }
      return filtered;
    }

    // Normal mode: local filter
    let filtered = sessions;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) => (s.name || s.id).toLowerCase().includes(q) || s.work_dir.toLowerCase().includes(q),
      );
    }
    if (statusFilter === "all") {
      filtered = filtered.filter((s) => s.status !== "archived");
    } else {
      filtered = filtered.filter((s) => s.status === statusFilter);
    }
    return filtered;
  }, [sessions, searchQuery, statusFilter, ftsMode, debouncedQuery, ftsData]);

  // Always group sessions by workspace
  const groupedSessions = useMemo(() => {
    if (!filteredSessions.length) return null;

    const groups = new Map<string | null, SessionInfo[]>();
    for (const session of filteredSessions) {
      const key = session.workspace_id ?? null;
      const list = groups.get(key);
      if (list) {
        list.push(session);
      } else {
        groups.set(key, [session]);
      }
    }

    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      const nameA = workspaceMap.get(a) ?? a;
      const nameB = workspaceMap.get(b) ?? b;
      return nameA.localeCompare(nameB);
    });
  }, [filteredSessions, workspaceMap]);

  return (
    <aside
      className={cn(
        "h-full flex flex-col bg-sidebar overflow-hidden",
        isMobileOverlay
          ? "w-[280px]"
          : "border-r border-sidebar-border transition-[width,min-width] duration-200 ease-in-out",
        !isMobileOverlay && (collapsed ? "w-16 min-w-16" : "w-[260px] min-w-[260px]"),
      )}
    >
      {/* New Session */}
      <div className="px-3 pt-3">
        {collapsed ? (
          <div className="flex flex-col gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  className="w-full h-9"
                  onClick={onNew}
                  aria-label="새 세션"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">새 세션</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Button
              variant="default"
              className="w-full flex items-center gap-2 px-3 py-2.5 font-mono text-md font-semibold"
              onClick={onNew}
            >
              <span className="text-base font-bold">+</span>
              New Session
            </Button>
            <Button
              variant="outline"
              className="w-full flex items-center gap-2 px-3 py-2 font-mono text-xs"
              onClick={() => setImportOpen(true)}
              aria-label="로컬 세션 불러오기"
            >
              <Download className="h-3.5 w-3.5" />
              Import Local
            </Button>
          </div>
        )}
      </div>

      {/* Sessions list header */}
      {collapsed ? null : (
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="font-mono text-2xs font-semibold text-muted-foreground tracking-widest">
            SESSIONS
          </span>
          <Badge variant="secondary" className="font-mono text-2xs">
            {filteredSessions.length}
            {filteredSessions.length !== nonArchivedTotal ? `/${nonArchivedTotal}` : ""}
          </Badge>
        </div>
      )}

      {/* 검색 + FTS 토글 + 상태 필터 */}
      {collapsed ? null : (
        <div className="px-3 space-y-2 pb-2">
          <div className="flex items-center gap-1">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                className="w-full font-mono text-xs bg-input border border-border rounded pl-7 pr-7 py-1.5 outline-none focus:border-primary/50"
                placeholder={ftsMode ? "대화 내용 검색 (FTS)…" : "세션 검색…"}
                aria-label="세션 검색"
                value={searchQuery}
                onChange={(e) => handleQueryChange(e.target.value)}
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
                  onClick={() => handleQueryChange("")}
                  aria-label="검색 초기화"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            {/* FTS 토글 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("size-7 shrink-0", ftsMode && "text-primary")}
                  onClick={() => setFtsMode(!ftsMode)}
                  aria-label={ftsMode ? "일반 검색으로 전환" : "전문 검색으로 전환"}
                >
                  <FileSearch className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {ftsMode ? "전문 검색 켜짐 (대화 내용 포함)" : "전문 검색 (대화 내용)"}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex gap-1">
            {(["all", "running", "idle", "error", "archived"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={cn(
                  "font-mono text-2xs px-2 py-0.5 rounded-sm border transition-colors",
                  statusFilter === f
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "text-muted-foreground border-transparent hover:bg-muted",
                )}
                onClick={() => setStatusFilter(f)}
              >
                {
                  { all: "All", running: "Run", idle: "Idle", error: "Err", archived: "Archived" }[
                    f
                  ]
                }
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sessions list */}
      <ScrollArea className={cn("flex-1 min-h-0", collapsed ? "px-1 pt-3" : "px-2")}>
        {isLoading ? (
          <div className="px-2 pt-2 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-sm animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          collapsed ? null : (
            <div className="py-6 px-3 text-center font-mono text-xs text-destructive/80">
              세션 목록을 불러올 수 없습니다
            </div>
          )
        ) : sessions.length === 0 ? (
          collapsed ? null : (
            <div className="py-6 px-3 text-center font-mono text-xs text-muted-foreground/70">
              No active sessions
            </div>
          )
        ) : sessions.length > 0 && filteredSessions.length === 0 ? (
          collapsed ? null : (
            <div className="py-6 px-3 text-center font-mono text-xs text-muted-foreground/70">
              검색 결과가 없습니다
            </div>
          )
        ) : groupedSessions ? (
          groupedSessions.map(([wsId, groupSessions]) => (
            <SidebarWorkspaceGroup
              key={wsId ?? "__none__"}
              workspaceName={wsId ? (workspaceMap.get(wsId) ?? wsId) : null}
              sessions={groupSessions}
              activeSessionId={activeSessionId}
              onSelect={onSelect}
              onDelete={onDelete}
              onArchive={onArchive}
              onRename={onRename}
              collapsed={collapsed}
            />
          ))
        ) : (
          filteredSessions.map((s) =>
            collapsed ? (
              <Tooltip key={s.id}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "w-full flex items-center justify-center py-2.5 rounded-sm mb-1 transition-colors border border-transparent",
                      s.id === activeSessionId && "bg-muted border-border-bright",
                    )}
                    onClick={() => onSelect(s.id)}
                    aria-label={`세션 ${s.id}`}
                  >
                    <span
                      className={cn(
                        "w-2.5 h-2.5 rounded-full shrink-0",
                        s.status === "running" && "bg-success",
                        s.status === "error" && "bg-destructive",
                        s.status === "archived" && "bg-muted-foreground/40",
                        s.status !== "running" &&
                          s.status !== "error" &&
                          s.status !== "archived" &&
                          "bg-muted-foreground",
                      )}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-mono text-xs">
                  <p className="font-semibold">{s.id}</p>
                  <p className="text-muted-foreground">
                    {s.message_count} msgs · {s.file_changes_count} changes
                  </p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <SessionItem
                key={s.id}
                session={s}
                isActive={s.id === activeSessionId}
                onSelect={onSelect}
                onDelete={onDelete}
                onArchive={onArchive}
                onRename={onRename}
              />
            ),
          )
        )}
      </ScrollArea>

      {/* Footer: 뷰 모드 스위처 + 사이드바 토글 */}
      {isMobileOverlay ? null : (
        <div className={cn("py-3 border-t border-border", collapsed ? "px-2" : "px-4")}>
          <div
            className={cn(
              "flex items-center",
              collapsed ? "flex-col gap-1" : "justify-center gap-1",
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7", viewMode === "dashboard" && "bg-muted")}
                  onClick={() => {
                    setViewMode("dashboard");
                    navigate({ to: "/" });
                  }}
                  aria-label="대시보드 뷰"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={collapsed ? "right" : "top"}>Dashboard</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7", viewMode === "single" && "bg-muted")}
                  onClick={() => {
                    setViewMode("single");
                    const targetId = activeSessionId ?? sessions[0]?.id;
                    if (targetId) {
                      navigate({ to: "/session/$sessionId", params: { sessionId: targetId } });
                    } else {
                      navigate({ to: "/session/new" });
                    }
                  }}
                  aria-label="단일 뷰"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={collapsed ? "right" : "top"}>Single</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7", viewMode === "split" && "bg-muted")}
                  onClick={() => {
                    setViewMode("split");
                    const targetId = activeSessionId ?? sessions[0]?.id;
                    if (targetId) {
                      navigate({ to: "/session/$sessionId", params: { sessionId: targetId } });
                    } else {
                      navigate({ to: "/session/new" });
                    }
                  }}
                  aria-label="분할 뷰"
                >
                  <Columns2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={collapsed ? "right" : "top"}>Split</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => navigate({ to: "/knowledge-base" })}
                  aria-label="Knowledge Base"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={collapsed ? "right" : "top"}>Knowledge Base</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={toggleSidebar}
                  aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
                >
                  {collapsed ? (
                    <PanelLeftOpen className="h-3.5 w-3.5" />
                  ) : (
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side={collapsed ? "right" : "top"}>
                {collapsed ? "사이드바 펼치기" : "사이드바 접기"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
      <ImportLocalDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={(id) => {
          setImportOpen(false);
          onImported?.(id);
        }}
      />
    </aside>
  );
});

/** 워크스페이스별 Collapsible 그룹 (사이드바용) */
const SidebarWorkspaceGroup = memo(function SidebarWorkspaceGroup({
  workspaceName,
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  onArchive,
  onRename,
  collapsed,
}: {
  workspaceName: string | null;
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(true);

  if (collapsed) {
    return (
      <>
        {sessions.map((s) => (
          <Tooltip key={s.id}>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center justify-center py-2.5 rounded-sm mb-1 transition-colors border border-transparent",
                  s.id === activeSessionId && "bg-muted border-border-bright",
                )}
                onClick={() => onSelect(s.id)}
                aria-label={`세션 ${s.id}`}
              >
                <span
                  className={cn(
                    "w-2.5 h-2.5 rounded-full shrink-0",
                    s.status === "running" && "bg-success",
                    s.status === "error" && "bg-destructive",
                    s.status === "archived" && "bg-muted-foreground/40",
                    s.status !== "running" &&
                      s.status !== "error" &&
                      s.status !== "archived" &&
                      "bg-muted-foreground",
                  )}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-mono text-xs">
              <p className="font-semibold">{s.id}</p>
              <p className="text-muted-foreground">
                {s.message_count} msgs · {s.file_changes_count} changes
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
      </>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-1">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 hover:bg-muted/50 transition-colors rounded-sm"
        >
          {open ? (
            <ChevronDownIcon className="h-3 w-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          <span className="font-mono text-2xs font-semibold text-foreground truncate">
            {workspaceName ?? "워크스페이스 미지정"}
          </span>
          <span className="font-mono text-2xs text-muted-foreground shrink-0">
            ({sessions.length})
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {sessions.map((s) => (
          <SessionItem
            key={s.id}
            session={s}
            isActive={s.id === activeSessionId}
            onSelect={onSelect}
            onDelete={onDelete}
            onArchive={onArchive}
            onRename={onRename}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
});

const SessionItem = memo(function SessionItem({
  session: s,
  isActive,
  onSelect,
  onDelete,
  onArchive,
  onRename,
}: {
  session: SessionInfo;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onRename?: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = useCallback(() => {
    setEditValue(s.name || s.id);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [s.name, s.id]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== (s.name || s.id) && onRename) {
      onRename(s.id, trimmed);
    }
  }, [editValue, s.name, s.id, onRename]);

  const isArchived = s.status === "archived";
  const displayName = s.name || s.id;

  const handleXClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isArchived) {
        setDeleteConfirmOpen(true);
      } else {
        onArchive(s.id);
      }
    },
    [isArchived, onArchive, s.id],
  );

  return (
    <button
      type="button"
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-sm cursor-pointer mb-1 transition-colors border border-transparent overflow-hidden min-w-0",
        isActive && "bg-muted border-border-bright",
      )}
      onClick={() => onSelect(s.id)}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            s.status === "running" && "bg-success",
            s.status === "error" && "bg-destructive",
            s.status !== "running" && s.status !== "error" && "bg-muted-foreground",
          )}
        />
        {editing ? (
          <input
            ref={inputRef}
            className="font-mono text-md font-medium text-foreground flex-1 bg-input border border-border rounded px-1 py-0.5 outline-none focus:border-primary/50 min-w-0"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="font-mono text-md font-medium text-foreground flex-1 truncate"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEditing();
                }}
              >
                {displayName}
              </span>
            </TooltipTrigger>
            <TooltipContent className="font-mono text-xs">{displayName}</TooltipContent>
          </Tooltip>
        )}
        {s.parent_session_id ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <GitFork className="h-3 w-3 shrink-0 text-info/60" />
            </TooltipTrigger>
            <TooltipContent className="font-mono text-xs">포크된 세션</TooltipContent>
          </Tooltip>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-5 h-5 opacity-50 hover:opacity-100"
              onClick={handleXClick}
              aria-label={isArchived ? "세션 삭제" : "세션 보관"}
            >
              {"×"}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="font-mono text-xs">
            {isArchived ? "삭제" : "보관"}
          </TooltipContent>
        </Tooltip>
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-mono text-sm">
                세션을 삭제하시겠습니까?
              </AlertDialogTitle>
              <AlertDialogDescription className="font-mono text-xs">
                "{s.name || s.id}" 세션의 모든 대화 기록과 파일 변경 이력이 영구적으로 삭제됩니다.
                이 작업은 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-mono text-xs">취소</AlertDialogCancel>
              <AlertDialogAction
                className="font-mono text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => onDelete(s.id)}
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <div className="flex items-center gap-1 mb-0.5">
        <span className="font-mono text-2xs text-muted-foreground">{s.message_count} msgs</span>
        <span className="font-mono text-2xs text-muted-foreground/70">{"·"}</span>
        <span className="font-mono text-2xs text-muted-foreground">
          {s.file_changes_count} changes
        </span>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="font-mono text-2xs text-muted-foreground/70 truncate">
            {formatWorkDir(s.work_dir)}
          </div>
        </TooltipTrigger>
        <TooltipContent className="font-mono text-xs">{s.work_dir}</TooltipContent>
      </Tooltip>
    </button>
  );
});
