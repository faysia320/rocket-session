import { memo, useState, useCallback, useMemo, lazy, Suspense } from "react";
import { useTheme } from "next-themes";
import { useNavigate, useLocation } from "@tanstack/react-router";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Clock,
  GitBranch,
  MessageSquare,
  PanelLeft,
  Sun,
  Moon,
  Command,
  Bell,
  BellOff,
  Settings,
  StickyNote,
  MoreHorizontal,
  Users,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useSessionStore, useCommandPaletteStore, useMemoStore } from "@/store";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useNotificationCenter } from "@/features/notification/hooks/useNotificationCenter";
import { useUsage } from "@/features/usage/hooks/useUsage";

const GlobalSettingsDialog = lazy(() =>
  import("@/features/settings/components/GlobalSettingsDialog").then((m) => ({
    default: m.GlobalSettingsDialog,
  })),
);

const NAV_ITEMS = [
  { to: "/" as const, label: "Sessions", icon: MessageSquare },
  { to: "/workflows" as const, label: "Workflows", icon: Workflow },
  { to: "/git-monitor" as const, label: "Git", icon: GitBranch },
  { to: "/team" as const, label: "Team", icon: Users },
  { to: "/analytics" as const, label: "Analytics", icon: BarChart3 },
  { to: "/knowledge-base" as const, label: "Knowledge", icon: BookOpen },
] as const;

export const GlobalTopBar = memo(function GlobalTopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const setViewMode = useSessionStore((s) => s.setViewMode);
  const setSidebarMobileOpen = useSessionStore((s) => s.setSidebarMobileOpen);
  const isMobile = useIsMobile();

  const openPalette = useCommandPaletteStore((s) => s.open);

  const {
    settings: notificationSettings,
    toggleEnabled: toggleNotifications,
    requestDesktopPermission,
  } = useNotificationCenter();

  // Sessions 탭은 / 와 /session, Team 탭은 /team 에서 활성
  const isActive = useCallback(
    (to: string) => {
      if (to === "/") {
        return location.pathname === "/" || location.pathname.startsWith("/session");
      }
      if (to === "/team") {
        return location.pathname.startsWith("/team");
      }
      return location.pathname.startsWith(to);
    },
    [location.pathname],
  );

  const handleNavClick = useCallback(
    (e: React.MouseEvent, to: string) => {
      // Ctrl+Click (Win/Linux) / Cmd+Click (Mac) → 새 탭
      if (e.ctrlKey || e.metaKey) {
        window.open(to, "_blank");
        return;
      }
      // Shift+Click → 새 창
      if (e.shiftKey) {
        window.open(to);
        return;
      }

      if (to === "/") {
        // Sessions 클릭 → 세션 홈(대시보드 뷰)으로 이동
        setViewMode("dashboard");
        navigate({ to: "/" });
      } else {
        navigate({ to });
      }
    },
    [setViewMode, navigate],
  );

  const handleNotificationToggle = useCallback(async () => {
    if (!notificationSettings.enabled) {
      await requestDesktopPermission();
    }
    toggleNotifications();
  }, [notificationSettings.enabled, requestDesktopPermission, toggleNotifications]);

  const handleSettingsOpen = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  return (
    <header className="h-10 shrink-0 flex items-center px-2 bg-sidebar border-b border-sidebar-border gap-2 z-40">
      {/* 모바일: 사이드바 열기 */}
      {isMobile ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => setSidebarMobileOpen(true)}
          aria-label="세션 목록"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      ) : null}

      {/* 좌측: 네비게이션 */}
      <nav className="hidden md:flex items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <Button
            key={item.to}
            variant="ghost"
            className={cn(
              "h-8 gap-1.5 font-mono text-xs px-3",
              isActive(item.to) && "bg-muted text-foreground",
            )}
            onClick={(e) => handleNavClick(e, item.to)}
            aria-label={item.label}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </Button>
        ))}
      </nav>

      {/* 우측: 사용량 + 글로벌 액션 */}
      <div className="flex items-center gap-0.5 ml-auto shrink-0">
        <UsageIndicator />

        {/* 명령 팔레트 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hidden sm:inline-flex"
              onClick={openPalette}
              aria-label="명령 팔레트 (Ctrl+K)"
            >
              <Command className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">명령 팔레트 ⌘K</TooltipContent>
        </Tooltip>

        {/* 알림 토글 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 hidden sm:inline-flex",
                notificationSettings.enabled && "text-primary",
              )}
              onClick={handleNotificationToggle}
              aria-label={notificationSettings.enabled ? "알림 비활성화" : "알림 활성화"}
            >
              {notificationSettings.enabled ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {notificationSettings.enabled ? "알림 켜짐" : "알림 꺼짐"}
          </TooltipContent>
        </Tooltip>

        {/* 글로벌 설정 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hidden sm:inline-flex"
              onClick={handleSettingsOpen}
              aria-label="글로벌 설정"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">설정</TooltipContent>
        </Tooltip>

        {/* GlobalSettingsDialog: 열릴 때만 lazy load */}
        {settingsOpen ? (
          <Suspense fallback={null}>
            <GlobalSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
          </Suspense>
        ) : null}

        {/* 메모 토글 */}
        <MemoToggle />

        {/* 테마 토글 */}
        <ThemeToggle />

        {/* 모바일: 더보기 드롭다운 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 md:hidden" aria-label="더보기">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 font-mono text-xs">
            <DropdownMenuLabel className="text-2xs text-muted-foreground">
              Navigation
            </DropdownMenuLabel>
            {NAV_ITEMS.map((item) => (
              <DropdownMenuItem
                key={item.to}
                className={cn("gap-2", isActive(item.to) && "bg-muted")}
                onClick={(e) => handleNavClick(e, item.to)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-2xs text-muted-foreground">
              Actions
            </DropdownMenuLabel>
            <DropdownMenuItem className="gap-2 sm:hidden" onClick={openPalette}>
              <Command className="h-4 w-4" />
              명령 팔레트
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 sm:hidden" onClick={handleNotificationToggle}>
              {notificationSettings.enabled ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
              {notificationSettings.enabled ? "알림 끄기" : "알림 켜기"}
            </DropdownMenuItem>
            <MemoDropdownItem />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
});

function MemoToggle() {
  const isOpen = useMemoStore((s) => s.isOpen);
  const toggleMemo = useMemoStore((s) => s.toggleMemo);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 hidden sm:inline-flex", isOpen && "text-primary")}
          onClick={toggleMemo}
          aria-label="메모 (Ctrl+M)"
        >
          <StickyNote className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">메모 ⌘M</TooltipContent>
    </Tooltip>
  );
}

function MemoDropdownItem() {
  const toggleMemo = useMemoStore((s) => s.toggleMemo);

  return (
    <DropdownMenuItem className="gap-2 sm:hidden" onClick={toggleMemo}>
      <StickyNote className="h-4 w-4" />
      메모
    </DropdownMenuItem>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label="테마 변경"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{isDark ? "라이트 모드" : "다크 모드"}</TooltipContent>
    </Tooltip>
  );
}

function formatTimeRemaining(resetsAt: string | null): string {
  if (!resetsAt) return "--:--";
  const now = Date.now();
  const reset = new Date(resetsAt).getTime();
  const diffMs = reset - now;
  if (diffMs <= 0) return "00:00";
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  return `${String(hours).padStart(2, "0")}h${String(minutes).padStart(2, "0")}m`;
}

function utilizationColor(util: number): string {
  if (util >= 80) return "text-destructive";
  if (util >= 50) return "text-warning";
  return "text-success";
}

function UsageIndicator() {
  const { data, isLoading, isError } = useUsage();

  const fiveHourCountdown = useMemo(
    () => formatTimeRemaining(data?.five_hour?.resets_at ?? null),
    [data?.five_hour?.resets_at],
  );

  const sevenDayCountdown = useMemo(
    () => formatTimeRemaining(data?.seven_day?.resets_at ?? null),
    [data?.seven_day?.resets_at],
  );

  if (isLoading) {
    return <div className="h-3 w-32 animate-pulse rounded bg-muted mr-1" />;
  }

  if (isError || !data || !data.available) {
    const isRateLimited = data?.retry_after != null;
    const retryMin = data?.retry_after ? Math.ceil(data.retry_after / 60) : null;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center gap-1 text-2xs text-muted-foreground mr-1">
            {isRateLimited ? (
              <Clock className="h-3 w-3" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isRateLimited
            ? `사용량 조회 제한됨 (${retryMin}분 후 재시도)`
            : data?.error
              ? "사용량 정보를 일시적으로 가져올 수 없습니다"
              : "사용량 정보를 가져올 수 없습니다"}
        </TooltipContent>
      </Tooltip>
    );
  }

  const { five_hour, seven_day } = data;

  return (
    <div className="flex items-center gap-1 text-2xs text-muted-foreground whitespace-nowrap mr-1">
      <span className="text-muted-foreground/60">
        <span className="hidden sm:inline">5h</span>
        <span className="sm:hidden">h</span>:
      </span>
      <span className={cn("font-medium", utilizationColor(five_hour.utilization))}>
        {five_hour.utilization.toFixed(0)}%
      </span>
      <span className="text-muted-foreground/40 hidden sm:inline">({fiveHourCountdown})</span>

      <span className="text-border mx-0.5">|</span>

      <span className="text-muted-foreground/60">
        <span className="hidden sm:inline">7d</span>
        <span className="sm:hidden">w</span>:
      </span>
      <span className={cn("font-medium", utilizationColor(seven_day.utilization))}>
        {seven_day.utilization.toFixed(0)}%
      </span>
      <span className="text-muted-foreground/40 hidden sm:inline">({sevenDayCountdown})</span>
    </div>
  );
}
