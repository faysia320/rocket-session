import type { LucideIcon } from "lucide-react";

export type CommandCategory = "navigation" | "session" | "chat" | "ui" | "git";

export interface CommandContext {
  requiresActiveSession?: boolean;
  /** true=running 필요, false=idle 필요, undefined=무관 */
  requiresRunning?: boolean;
  requiresGit?: boolean;
}

export interface PaletteCommand {
  id: string;
  label: string;
  description: string;
  category: CommandCategory;
  icon: LucideIcon;
  /** 표시 전용 단축키 (예: "⌘F") */
  shortcut?: string;
  action: () => void;
  context?: CommandContext;
  /** 추가 검색 키워드 */
  keywords?: string[];
}

export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  navigation: "내비게이션",
  session: "세션",
  chat: "채팅",
  ui: "화면",
  git: "Git",
};

export const CATEGORY_ORDER: CommandCategory[] = [
  "navigation",
  "session",
  "chat",
  "ui",
  "git",
];
