import {
  PanelLeftClose,
  PanelLeftOpen,
  Columns2,
  Sun,
  Moon,
} from "lucide-react";
import type { PaletteCommand } from "../types";

export function createUICommands(deps: {
  toggleSidebar: () => void;
  toggleSplitView: () => void;
  toggleTheme: () => void;
  isDark: boolean;
  sidebarCollapsed: boolean;
}): PaletteCommand[] {
  const {
    toggleSidebar,
    toggleSplitView,
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
      keywords: ["sidebar", "사이드바", "토글"],
    },
    {
      id: "ui:toggle-split",
      label: "분할 뷰 전환",
      description: "여러 세션을 나란히 표시",
      category: "ui",
      icon: Columns2,
      action: toggleSplitView,
      keywords: ["split", "분할", "view"],
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
