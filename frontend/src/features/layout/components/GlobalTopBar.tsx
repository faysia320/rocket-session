import { memo } from "react";
import { useTheme } from "next-themes";
import { useNavigate, useLocation } from "@tanstack/react-router";
import {
  LayoutGrid,
  Clock,
  BarChart3,
  MessageSquare,
  Sun,
  Moon,
  Search,
  Bell,
  BellOff,
  Settings,
  FileStack,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
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
import { GlobalSettingsDialog } from "@/features/settings/components/GlobalSettingsDialog";
import { TemplateListDialog } from "@/features/template/components/TemplateListDialog";
import { useIsMobile } from "@/hooks/useMediaQuery";

const NAV_ITEMS = [
  { to: "/" as const, label: "Dashboard", icon: LayoutGrid },
  { to: "/session" as const, label: "Sessions", icon: MessageSquare },
  { to: "/history" as const, label: "History", icon: Clock },
  { to: "/analytics" as const, label: "Analytics", icon: BarChart3 },
] as const;

export const GlobalTopBar = memo(function GlobalTopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const sidebarCollapsed = useSessionStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useSessionStore((s) => s.toggleSidebar);
  const setSidebarMobileOpen = useSessionStore((s) => s.setSidebarMobileOpen);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);

  const openPalette = useCommandPaletteStore((s) => s.open);

  const {
    settings: notificationSettings,
    toggleEnabled: toggleNotifications,
    requestDesktopPermission,
  } = useNotificationCenter();

  const isActive = (to: string) => {
    if (to === "/") return location.pathname === "/";
    return location.pathname.startsWith(to);
  };

  const isOnSessionRoute = location.pathname.startsWith("/session");

  const handleNavClick = (to: string) => {
    if (to === "/session") {
      if (activeSessionId) {
        navigate({ to: "/session/$sessionId", params: { sessionId: activeSessionId } });
      } else {
        navigate({ to: "/session/new" });
      }
    } else {
      navigate({ to });
    }
  };

  const handleSidebarToggle = () => {
    if (isMobile) {
      setSidebarMobileOpen(true);
    } else {
      toggleSidebar();
    }
  };

  const handleNotificationToggle = async () => {
    if (!notificationSettings.enabled) {
      await requestDesktopPermission();
    }
    toggleNotifications();
  };

  return (
    <header className="h-10 shrink-0 flex items-center px-2 bg-sidebar border-b border-sidebar-border gap-2 z-40">
      {/* 좌측: 사이드바 토글 + 앱 타이틀 */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isOnSessionRoute ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleSidebarToggle}
                aria-label={
                  isMobile
                    ? "메뉴 열기"
                    : sidebarCollapsed
                      ? "사이드바 펼치기"
                      : "사이드바 접기"
                }
              >
                {isMobile ? (
                  <Menu className="h-4 w-4" />
                ) : sidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isMobile
                ? "세션 목록"
                : sidebarCollapsed
                  ? "사이드바 펼치기"
                  : "사이드바 접기"}
            </TooltipContent>
          </Tooltip>
        ) : null}
        <span className="hidden md:block font-mono text-sm font-semibold text-primary select-none">
          Rocket Session
        </span>
      </div>

      {/* 중앙: 네비게이션 */}
      <nav className="hidden md:flex flex-1 items-center justify-center gap-1">
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
        <GlobalSettingsDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hidden sm:inline-flex"
                aria-label="글로벌 설정"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">설정</TooltipContent>
          </Tooltip>
        </GlobalSettingsDialog>

        {/* 템플릿 */}
        <TemplateListDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hidden sm:inline-flex"
                aria-label="세션 템플릿"
              >
                <FileStack className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">템플릿</TooltipContent>
          </Tooltip>
        </TemplateListDialog>

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
