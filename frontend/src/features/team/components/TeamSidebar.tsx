import { useState, useMemo, memo } from "react";
import { PanelLeftClose, PanelLeftOpen, Plus, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store";
import { TeamCreateDialog } from "./TeamCreateDialog";
import type { TeamListItem } from "@/types";

interface TeamSidebarProps {
  teams: TeamListItem[];
  activeTeamId: string | null;
  onSelect: (id: string) => void;
  isMobileOverlay?: boolean;
  isLoading?: boolean;
  isError?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  active: "bg-success",
  completed: "bg-info",
  paused: "bg-warning",
  archived: "bg-muted-foreground/40",
};

export const TeamSidebar = memo(function TeamSidebar({
  teams,
  activeTeamId,
  onSelect,
  isMobileOverlay,
  isLoading,
  isError,
}: TeamSidebarProps) {
  const sidebarCollapsed = useSessionStore((s) => s.sidebarCollapsed);
  const collapsed = isMobileOverlay ? false : sidebarCollapsed;
  const toggleSidebar = useSessionStore((s) => s.toggleSidebar);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "paused" | "completed" | "archived"
  >("all");

  const filteredTeams = useMemo(() => {
    let filtered = teams;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((t) => t.name.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }
    return filtered;
  }, [teams, searchQuery, statusFilter]);

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
      {/* New Team */}
      <div className="px-3 pt-3">
        {collapsed ? (
          <TeamCreateDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="default" size="icon" className="w-full h-9" aria-label="새 팀">
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">새 팀</TooltipContent>
            </Tooltip>
          </TeamCreateDialog>
        ) : (
          <TeamCreateDialog>
            <Button
              variant="default"
              className="w-full flex items-center gap-2 px-3 py-2.5 font-mono text-md font-semibold"
            >
              <span className="text-base font-bold">+</span>
              New Team
            </Button>
          </TeamCreateDialog>
        )}
      </div>

      {/* Teams header */}
      {collapsed ? null : (
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="font-mono text-2xs font-semibold text-muted-foreground tracking-widest">
            TEAMS
          </span>
          <Badge variant="secondary" className="font-mono text-2xs">
            {filteredTeams.length}
            {filteredTeams.length !== teams.length ? `/${teams.length}` : ""}
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
              placeholder="팀 검색…"
              aria-label="팀 검색"
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
            {(["all", "active", "paused", "completed", "archived"] as const).map((f) => (
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
                  {
                    all: "All",
                    active: "Active",
                    paused: "Paused",
                    completed: "Done",
                    archived: "Archived",
                  }[f]
                }
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Team list */}
      <ScrollArea className={cn("flex-1 min-h-0", collapsed ? "px-1 pt-3" : "px-2")}>
        {isLoading ? (
          <div className="px-2 pt-2 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-muted rounded-sm animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          collapsed ? null : (
            <div className="py-6 px-3 text-center font-mono text-xs text-destructive/80">
              팀 목록을 불러올 수 없습니다
            </div>
          )
        ) : teams.length === 0 ? (
          collapsed ? null : (
            <div className="py-6 px-3 text-center font-mono text-xs text-muted-foreground/70">
              팀이 없습니다
            </div>
          )
        ) : filteredTeams.length === 0 ? (
          collapsed ? null : (
            <div className="py-6 px-3 text-center font-mono text-xs text-muted-foreground/70">
              검색 결과가 없습니다
            </div>
          )
        ) : (
          filteredTeams.map((t) =>
            collapsed ? (
              <Tooltip key={t.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "w-full flex items-center justify-center py-2.5 rounded-sm mb-1 transition-colors border border-transparent",
                      t.id === activeTeamId && "bg-muted border-border-bright",
                    )}
                    onClick={() => onSelect(t.id)}
                    aria-label={`팀 ${t.name}`}
                  >
                    <Users className="h-3.5 w-3.5 text-primary/70" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-mono text-xs">
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-muted-foreground">{t.member_count}명 멤버</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <TeamSidebarItem
                key={t.id}
                team={t}
                isActive={t.id === activeTeamId}
                onSelect={onSelect}
              />
            ),
          )
        )}
      </ScrollArea>

      {/* Footer: 사이드바 토글 */}
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
    </aside>
  );
});

const TeamSidebarItem = memo(function TeamSidebarItem({
  team: t,
  isActive,
  onSelect,
}: {
  team: TeamListItem;
  isActive: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-sm cursor-pointer mb-1 transition-colors border border-transparent overflow-hidden min-w-0",
        isActive && "bg-muted border-border-bright",
      )}
      onClick={() => onSelect(t.id)}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            STATUS_COLOR[t.status] ?? "bg-muted-foreground",
          )}
        />
        <span className="font-mono text-md font-medium text-foreground flex-1 truncate">
          {t.name}
        </span>
        <Badge variant="secondary" className="font-mono text-2xs shrink-0">
          {t.member_count}
        </Badge>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-mono text-2xs text-muted-foreground">
          {t.task_summary.total} 태스크
        </span>
        <span className="font-mono text-2xs text-muted-foreground/70">{"·"}</span>
        <span className="font-mono text-2xs text-muted-foreground">
          {t.task_summary.completed} 완료
        </span>
      </div>
    </button>
  );
});
