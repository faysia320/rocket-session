import { useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { useSessionStore, useCommandPaletteStore } from "@/store";
import { sessionsApi } from "@/lib/api/sessions.api";
import { sessionKeys } from "@/features/session/hooks/sessionKeys";
import { useGitInfo } from "@/features/directory/hooks/useGitInfo";
import { useSessions } from "@/features/session/hooks/useSessions";
import type { SessionInfo } from "@/types";
import type { PaletteCommand, CommandCategory } from "../types";
import { CATEGORY_ORDER } from "../types";
import {
  filterCommandsByContext,
  resolveRouteZone,
  type RuntimeContext,
} from "../registry";
import {
  createNavigationCommands,
  createSessionCommands,
  createChatCommands,
  createUICommands,
  createGitCommands,
} from "../commands";

function extractSessionIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/session\/([^/]+)/);
  if (!match || match[1] === "new") return null;
  return match[1];
}

export function useCommandPalette() {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme, setTheme } = useTheme();

  const sidebarCollapsed = useSessionStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useSessionStore((s) => s.toggleSidebar);
  const viewMode = useSessionStore((s) => s.viewMode);
  const setViewMode = useSessionStore((s) => s.setViewMode);
  const focusedSessionId = useSessionStore((s) => s.focusedSessionId);

  const recentCommandIds = useCommandPaletteStore((s) => s.recentCommandIds);

  const { deleteSession } = useSessions();

  const { data: sessions = [] } = useQuery<SessionInfo[]>({
    queryKey: sessionKeys.list(),
    queryFn: () => sessionsApi.list(),
    staleTime: 10_000,
  });

  const urlSessionId = extractSessionIdFromPath(location.pathname);
  const activeSessionId = viewMode === "split" ? focusedSessionId : urlSessionId;
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const workDir = activeSession?.work_dir ?? "";
  const { gitInfo } = useGitInfo(workDir);

  const isDark = resolvedTheme === "dark";
  const toggleTheme = useCallback(() => {
    setTheme(isDark ? "light" : "dark");
  }, [isDark, setTheme]);

  const selectSession = useCallback(
    (id: string) => {
      navigate({ to: "/session/$sessionId", params: { sessionId: id } });
    },
    [navigate],
  );

  const navigateHome = useCallback(() => {
    navigate({ to: "/" });
  }, [navigate]);

  const stopSession = useCallback(async (id: string) => {
    try {
      await sessionsApi.stop(id);
      toast.success("세션이 중지되었습니다");
    } catch {
      toast.error("세션 중지에 실패했습니다");
    }
  }, []);

  const exportSession = useCallback(async (id: string) => {
    try {
      await sessionsApi.exportMarkdown(id);
      toast.success("Markdown으로 내보냈습니다");
    } catch {
      toast.error("내보내기에 실패했습니다");
    }
  }, []);

  const forkSession = useCallback(async (id: string) => {
    try {
      const forked = await sessionsApi.fork(id);
      toast.success(`세션이 포크되었습니다: ${forked.name || forked.id}`);
      navigate({ to: "/session/$sessionId", params: { sessionId: forked.id } });
    } catch {
      toast.error("세션 포크에 실패했습니다");
    }
  }, [navigate]);

  const allCommands = useMemo(() => {
    const navCmds = createNavigationCommands({
      navigate,
      sessions,
      selectSession,
    });
    const sessionCmds = createSessionCommands({
      activeSessionId,
      stopSession,
      deleteSession,
      exportSession,
      forkSession,
    });
    const chatCmds = createChatCommands({ activeSessionId });
    const uiCmds = createUICommands({
      toggleSidebar,
      setViewMode,
      navigateHome,
      toggleTheme,
      isDark,
      sidebarCollapsed,
    });
    const hasChanges = gitInfo?.is_dirty || gitInfo?.has_untracked || false;
    const gitCmds = createGitCommands({ hasChanges });

    return [...navCmds, ...sessionCmds, ...chatCmds, ...uiCmds, ...gitCmds];
  }, [
    navigate,
    sessions,
    selectSession,
    activeSessionId,
    stopSession,
    deleteSession,
    exportSession,
    forkSession,
    toggleSidebar,
    setViewMode,
    navigateHome,
    toggleTheme,
    isDark,
    sidebarCollapsed,
    gitInfo,
  ]);

  const runtimeContext: RuntimeContext = useMemo(
    () => ({
      activeSessionId,
      sessionStatus: activeSession?.status ?? null,
      isGitRepo: gitInfo?.is_git_repo ?? false,
      routeZone: resolveRouteZone(location.pathname),
    }),
    [activeSessionId, activeSession?.status, gitInfo?.is_git_repo, location.pathname],
  );

  const filteredCommands = useMemo(
    () => filterCommandsByContext(allCommands, runtimeContext),
    [allCommands, runtimeContext],
  );

  const groupedCommands = useMemo(() => {
    const recentIdSet = new Set(recentCommandIds);
    const groups: Record<CommandCategory, PaletteCommand[]> = {
      navigation: [],
      session: [],
      chat: [],
      ui: [],
      git: [],
    };
    for (const cmd of filteredCommands) {
      if (!recentIdSet.has(cmd.id)) {
        groups[cmd.category].push(cmd);
      }
    }
    return groups;
  }, [filteredCommands, recentCommandIds]);

  const recentCommands = useMemo(() => {
    const cmdMap = new Map(filteredCommands.map((c) => [c.id, c]));
    return recentCommandIds
      .map((id) => cmdMap.get(id))
      .filter((c): c is PaletteCommand => c !== undefined);
  }, [filteredCommands, recentCommandIds]);

  return {
    groupedCommands,
    recentCommands,
    categoryOrder: CATEGORY_ORDER,
  };
}
