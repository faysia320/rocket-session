import { LayoutGrid, Plus, Monitor, BarChart3, Clock, GitBranch } from "lucide-react";
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
      label: "세션 홈",
      description: "세션 대시보드 화면",
      category: "navigation",
      icon: LayoutGrid,
      action: () => navigate({ to: "/" }),
      keywords: ["home", "메인", "대시보드", "dashboard", "세션"],
    },
    {
      id: "nav:analytics",
      label: "토큰 분석",
      description: "토큰 사용량 분석 대시보드",
      category: "navigation",
      icon: BarChart3,
      action: () => navigate({ to: "/analytics" }),
      keywords: ["token", "analytics", "cost", "토큰", "분석", "비용"],
    },
    {
      id: "nav:history",
      label: "세션 히스토리",
      description: "세션 검색 및 필터",
      category: "navigation",
      icon: Clock,
      action: () => navigate({ to: "/history" }),
      keywords: ["history", "히스토리", "검색", "기록"],
    },
    {
      id: "nav:git-monitor",
      label: "Git Monitor",
      description: "Git 저장소 모니터링 및 PR 리뷰",
      category: "navigation",
      icon: GitBranch,
      action: () => navigate({ to: "/git-monitor" }),
      keywords: ["git", "monitor", "깃", "모니터", "pr", "commit", "커밋", "풀리퀘스트"],
    },
    {
      id: "nav:new-session",
      label: "새 세션 생성",
      description: "새로운 Claude Code 세션 시작",
      category: "navigation",
      icon: Plus,
      action: () => navigate({ to: "/session/new" }),
      context: {
        allowedZones: ["home", "session-workspace", "history", "analytics"],
      },
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
