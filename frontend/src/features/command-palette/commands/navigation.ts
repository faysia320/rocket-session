import { Home, Plus, Monitor } from "lucide-react";
import type { PaletteCommand } from "../types";
import type { SessionInfo } from "@/types";

export function createNavigationCommands(deps: {
  navigate: (opts: { to: string; params?: Record<string, string> }) => void;
  sessions: SessionInfo[];
  selectSession: (id: string) => void;
}): PaletteCommand[] {
  const { navigate, sessions, selectSession } = deps;

  const staticCommands: PaletteCommand[] = [
    {
      id: "nav:home",
      label: "홈으로 이동",
      description: "메인 화면으로 돌아가기",
      category: "navigation",
      icon: Home,
      action: () => navigate({ to: "/" }),
      keywords: ["home", "메인", "대시보드"],
    },
    {
      id: "nav:new-session",
      label: "새 세션 생성",
      description: "새로운 Claude Code 세션 시작",
      category: "navigation",
      icon: Plus,
      action: () => navigate({ to: "/session/new" }),
      keywords: ["new", "create", "session", "생성"],
    },
  ];

  const sessionCommands: PaletteCommand[] = sessions.map((s) => ({
    id: `nav:session:${s.id}`,
    label: `세션: ${s.name || s.id.slice(0, 8)}`,
    description: `${s.work_dir} (${s.status})`,
    category: "navigation" as const,
    icon: Monitor,
    action: () => selectSession(s.id),
    keywords: [s.id, s.name || "", s.work_dir, "session", "세션"],
  }));

  return [...staticCommands, ...sessionCommands];
}
