import {
  PanelLeftClose,
  PanelLeftOpen,
  Columns2,
  LayoutGrid,
  MessageSquare,
  Sun,
  Moon,
} from "lucide-react";
import type { PaletteCommand } from "../types";
import type { ViewMode } from "@/store/useSessionStore";

export function createUICommands(deps: {
  toggleSidebar: () => void;
  setViewMode: (mode: ViewMode) => void;
  navigateHome: () => void;
  toggleTheme: () => void;
  isDark: boolean;
  sidebarCollapsed: boolean;
}): PaletteCommand[] {
  const {
    toggleSidebar,
    setViewMode,
    navigateHome,
    toggleTheme,
    isDark,
    sidebarCollapsed,
  } = deps;

  return [
    {
      id: "ui:toggle-sidebar",
      label: sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기",
      description: "사이드바 표시/숨김 전환",
      category: "ui",
      icon: sidebarCollapsed ? PanelLeftOpen : PanelLeftClose,
      shortcut: "⌘B",
      action: toggleSidebar,
      context: { allowedZones: ["home", "session-workspace", "session-new"] },
      keywords: ["sidebar", "사이드바", "토글"],
    },
    {
      id: "ui:view-dashboard",
      label: "대시보드 뷰",
      description: "세션 카드 그리드 + Git 모니터",
      category: "ui",
      icon: LayoutGrid,
      action: () => {
        setViewMode("dashboard");
        navigateHome();
      },
      context: { allowedZones: ["home", "session-workspace", "session-new"] },
      keywords: ["dashboard", "대시보드", "view", "뷰", "홈"],
    },
    {
      id: "ui:view-single",
      label: "단일 뷰",
      description: "하나의 세션에 집중",
      category: "ui",
      icon: MessageSquare,
      action: () => setViewMode("single"),
      context: { allowedZones: ["home", "session-workspace", "session-new"] },
      keywords: ["single", "단일", "view", "뷰"],
    },
    {
      id: "ui:view-split",
      label: "분할 뷰",
      description: "여러 세션을 나란히 표시",
      category: "ui",
      icon: Columns2,
      action: () => setViewMode("split"),
      context: { allowedZones: ["home", "session-workspace", "session-new"] },
      keywords: ["split", "분할", "view", "뷰"],
    },
    {
      id: "ui:toggle-theme",
      label: isDark ? "라이트 모드로 전환" : "다크 모드로 전환",
      description: "테마 변경 (Deep Space ↔ Catppuccin Latte)",
      category: "ui",
      icon: isDark ? Sun : Moon,
      action: toggleTheme,
      keywords: ["theme", "dark", "light", "테마", "다크", "라이트"],
    },
  ];
}
