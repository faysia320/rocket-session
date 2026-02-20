import { useState, useRef, useCallback, useMemo, memo } from "react";
import { useTheme } from "next-themes";
import {
  Sun,
  Moon,
  Columns2,
  LayoutGrid,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Search,
  X,
  Bell,
  BellOff,
} from "lucide-react";
import { useNotificationCenter } from "@/features/notification/hooks/useNotificationCenter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
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
import { cn } from "@/lib/utils";
import type { SessionInfo } from "@/types";
import { ImportLocalDialog } from "./ImportLocalDialog";
import { GlobalSettingsDialog } from "@/features/settings/components/GlobalSettingsDialog";
import { useSessionStore } from "@/store";

interface SidebarProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
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
  onRename,
  onImported,
  isMobileOverlay,
  isLoading,
  isError,
}: SidebarProps) {
  const splitView = useSessionStore((s) => s.splitView);
  const toggleSplitView = useSessionStore((s) => s.toggleSplitView);
  const dashboardView = useSessionStore((s) => s.dashboardView);
  const toggleDashboardView = useSessionStore((s) => s.toggleDashboardView);
  const sidebarCollapsed = useSessionStore((s) => s.sidebarCollapsed);
  const collapsed = isMobileOverlay ? false : sidebarCollapsed;
  const toggleSidebar = useSessionStore((s) => s.toggleSidebar);
  const [importOpen, setImportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "running" | "idle" | "error" | "archived"
  >("all");
  const {
    settings: notificationSettings,
    toggleEnabled: toggleNotifications,
    requestDesktopPermission,
  } = useNotificationCenter();

  const filteredSessions = useMemo(() => {
    let filtered = sessions;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          (s.name || s.id).toLowerCase().includes(q) ||
          s.work_dir.toLowerCase().includes(q),
      );
    }
    if (statusFilter === "all") {
      filtered = filtered.filter((s) => s.status !== "archived");
    } else {
      filtered = filtered.filter((s) => s.status === statusFilter);
    }
    return filtered;
  }, [sessions, searchQuery, statusFilter]);

  return (
    <aside
      className={cn(
        "h-full flex flex-col bg-sidebar overflow-hidden",
        isMobileOverlay
          ? "w-[280px]"
          : "border-r border-sidebar-border transition-[width,min-width] duration-200 ease-in-out",
        !isMobileOverlay &&
          (collapsed ? "w-16 min-w-16" : "w-[260px] min-w-[260px]"),
      )}
    >
      {/* New Session */}
      <div className="px-3 pt-3">
        {collapsed ? (
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
            {filteredSessions.length !== sessions.length
              ? `/${sessions.length}`
              : ""}
          </Badge>
        </div>
      )}

      {/* 검색 + 상태 필터 */}
      {collapsed ? null : (
        <div className="px-3 space-y-2 pb-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              className="w-full font-mono text-xs bg-input border border-border rounded pl-7 pr-7 py-1.5 outline-none focus:border-primary/50"
              placeholder="세션 검색…"
              aria-label="세션 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"
                onClick={() => setSearchQuery("")}
                aria-label="검색 초기화"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
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
                {{ all: "All", running: "Run", idle: "Idle", error: "Err", archived: "Archived" }[f]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sessions list */}
      <ScrollArea
        className={cn("flex-1 min-h-0", collapsed ? "px-1 pt-3" : "px-2")}
      >
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
        ) : (
          filteredSessions.map((s) =>
            collapsed ? (
              <Tooltip key={s.id}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "w-full flex items-center justify-center py-2.5 rounded-sm mb-1 transition-all border border-transparent",
                      s.id === activeSessionId &&
                        "bg-muted border-[hsl(var(--border-bright))]",
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
                onRename={onRename}
              />
            ),
          )
        )}
      </ScrollArea>

      {/* Footer: 설정, 테마, Split View, 접기 */}
      <div
        className={cn(
          "py-3 border-t border-border",
          collapsed ? "px-2" : "px-4",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-1",
            collapsed ? "flex-col" : "justify-center",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  notificationSettings.enabled && "text-primary",
                )}
                onClick={async () => {
                  if (!notificationSettings.enabled) {
                    await requestDesktopPermission();
                  }
                  toggleNotifications();
                }}
                aria-label={
                  notificationSettings.enabled ? "알림 비활성화" : "알림 활성화"
                }
              >
                {notificationSettings.enabled ? (
                  <Bell className="h-4 w-4" />
                ) : (
                  <BellOff className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={collapsed ? "right" : "top"}>
              {notificationSettings.enabled ? "알림 켜짐" : "알림 꺼짐"}
            </TooltipContent>
          </Tooltip>
          <GlobalSettingsDialog>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="글로벌 설정"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </GlobalSettingsDialog>
          <ThemeToggle />
          {isMobileOverlay ? null : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-8 w-8", dashboardView && "bg-muted")}
                    onClick={toggleDashboardView}
                    aria-label={
                      dashboardView ? "대시보드 뷰 끄기" : "대시보드 뷰 켜기"
                    }
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={collapsed ? "right" : "top"}>
                  Dashboard
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-8 w-8", splitView && "bg-muted")}
                    onClick={toggleSplitView}
                    aria-label={splitView ? "단일 뷰로 전환" : "분할 뷰로 전환"}
                  >
                    <Columns2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={collapsed ? "right" : "top"}>
                  Split View
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={toggleSidebar}
                    aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
                  >
                    {collapsed ? (
                      <PanelLeftOpen className="h-4 w-4" />
                    ) : (
                      <PanelLeftClose className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={collapsed ? "right" : "top"}>
                  {collapsed ? "사이드바 펼치기" : "사이드바 접기"}
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>
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

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="테마 변경"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

const SessionItem = memo(function SessionItem({
  session: s,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  session: SessionInfo;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
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

  const displayName = s.name || s.id;

  return (
    <button
      type="button"
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-sm cursor-pointer mb-1 transition-all border border-transparent overflow-hidden min-w-0",
        isActive && "bg-muted border-[hsl(var(--border-bright))]",
      )}
      onClick={() => onSelect(s.id)}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            s.status === "running" && "bg-success",
            s.status === "error" && "bg-destructive",
            s.status !== "running" &&
              s.status !== "error" &&
              "bg-muted-foreground",
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
        <Button
          variant="ghost"
          size="icon"
          className="w-5 h-5 opacity-50 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteConfirmOpen(true);
          }}
          aria-label="세션 삭제"
        >
          {"×"}
        </Button>
        <AlertDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
        >
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-mono text-sm">
                세션을 삭제하시겠습니까?
              </AlertDialogTitle>
              <AlertDialogDescription className="font-mono text-xs">
                "{s.name || s.id}" 세션의 모든 대화 기록과 파일 변경 이력이
                영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-mono text-xs">
                취소
              </AlertDialogCancel>
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
        <span className="font-mono text-2xs text-muted-foreground">
          {s.message_count} msgs
        </span>
        <span className="font-mono text-2xs text-muted-foreground/70">
          {"·"}
        </span>
        <span className="font-mono text-2xs text-muted-foreground">
          {s.file_changes_count} changes
        </span>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="font-mono text-2xs text-muted-foreground/70 truncate">
            {truncatePath(s.work_dir)}
          </div>
        </TooltipTrigger>
        <TooltipContent className="font-mono text-xs">{s.work_dir}</TooltipContent>
      </Tooltip>
    </button>
  );
});

function truncatePath(p: string): string {
  if (!p) return "~";
  const parts = p.split(/[/\\]/);
  if (parts.length <= 3) return p;
  return "~/" + parts.slice(-2).join("/");
}
