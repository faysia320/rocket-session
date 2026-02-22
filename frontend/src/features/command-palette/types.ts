import type { LucideIcon } from "lucide-react";

export type CommandCategory = "navigation" | "session" | "chat" | "ui" | "git";

/** 명령 팔레트의 라우트 기반 필터링을 위한 존 정의.
 *  새 라우트 추가 시 여기에 존을 추가하고 registry.ts의 resolveRouteZone도 갱신할 것 */
export type RouteZone =
  | "home"
  | "session-workspace"
  | "session-new"
  | "history"
  | "analytics";

export interface CommandContext {
  requiresActiveSession?: boolean;
  /** true=running 필요, false=idle 필요, undefined=무관 */
  requiresRunning?: boolean;
  requiresGit?: boolean;
  /** 이 명령이 표시될 라우트 존. 미지정 시 모든 라우트에서 표시 */
  allowedZones?: RouteZone[];
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
