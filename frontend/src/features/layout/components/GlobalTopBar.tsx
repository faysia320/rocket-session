import { memo, useState, useCallback, lazy, Suspense } from "react";
import { useTheme } from "next-themes";
import { useNavigate, useLocation } from "@tanstack/react-router";
import {
  Clock,
  BarChart3,
  MessageSquare,
  Sun,
  Moon,
  Search,
  Bell,
  BellOff,
  Settings,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store";
import { useCommandPaletteStore } from "@/store";
import { useNotificationCenter } from "@/features/notification/hooks/useNotificationCenter";

const GlobalSettingsDialog = lazy(() =>
  import("@/features/settings/components/GlobalSettingsDialog").then((m) => ({
    default: m.GlobalSettingsDialog,
  })),
);

const NAV_ITEMS = [
  { to: "/" as const, label: "Sessions", icon: MessageSquare },
  { to: "/history" as const, label: "History", icon: Clock },
  { to: "/analytics" as const, label: "Analytics", icon: BarChart3 },
] as const;

export const GlobalTopBar = memo(function GlobalTopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const setViewMode = useSessionStore((s) => s.setViewMode);

  const openPalette = useCommandPaletteStore((s) => s.open);

  const {
    settings: notificationSettings,
    toggleEnabled: toggleNotifications,
    requestDesktopPermission,
  } = useNotificationCenter();

  // Sessions 탭은 / 와 /session 모두에서 활성
  const isActive = useCallback(
    (to: string) => {
      if (to === "/") {
        return location.pathname === "/" || location.pathname.startsWith("/session");
      }
      return location.pathname.startsWith(to);
    },
    [location.pathname],
  );

  const handleNavClick = useCallback(
    (to: string) => {
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
            onClick={() => handleNavClick(item.to)}
            aria-label={item.label}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </Button>
        ))}
      </nav>

      {/* 우측: 글로벌 액션 */}
      <div className="flex items-center gap-0.5 ml-auto shrink-0">
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
              <Search className="h-4 w-4" />
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
            <GlobalSettingsDialog
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
            />
          </Suspense>
        ) : null}

        {/* 테마 토글 */}
        <ThemeToggle />

        {/* 모바일: 더보기 드롭다운 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:hidden"
              aria-label="더보기"
            >
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
                className={cn(
                  "gap-2",
                  isActive(item.to) && "bg-muted",
                )}
                onClick={() => handleNavClick(item.to)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-2xs text-muted-foreground">
              Actions
            </DropdownMenuLabel>
            <DropdownMenuItem
              className="gap-2 sm:hidden"
              onClick={openPalette}
            >
              <Search className="h-4 w-4" />
              명령 팔레트
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 sm:hidden"
              onClick={handleNotificationToggle}
            >
              {notificationSettings.enabled ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
              {notificationSettings.enabled ? "알림 끄기" : "알림 켜기"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
});

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
          {isDark ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isDark ? "라이트 모드" : "다크 모드"}
      </TooltipContent>
    </Tooltip>
  );
}
