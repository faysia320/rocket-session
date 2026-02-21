import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";

const MAX_GIT_MONITOR_PATHS = 10;

export type ViewMode = "dashboard" | "single" | "split";

interface SessionState {
  activeSessionId: string | null;
  focusedSessionId: string | null;
  viewMode: ViewMode;
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  gitMonitorPaths: string[];
  setActiveSessionId: (id: string | null) => void;
  setFocusedSessionId: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleSidebar: () => void;
  setSidebarMobileOpen: (open: boolean) => void;
  addGitMonitorPath: (path: string) => void;
  removeGitMonitorPath: (path: string) => void;
  pendingPrompt: string | null;
  pendingPromptSessionId: string | null;
  setPendingPrompt: (prompt: string, sessionId: string) => void;
  clearPendingPrompt: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      activeSessionId: null,
      focusedSessionId: null,
      viewMode: "dashboard" as ViewMode,
      sidebarCollapsed: false,
      sidebarMobileOpen: false,
      gitMonitorPaths: [],
      setActiveSessionId: (id) => set({ activeSessionId: id }),
      setFocusedSessionId: (id) => set({ focusedSessionId: id }),
      setViewMode: (mode) => set({ viewMode: mode }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
      addGitMonitorPath: (path) =>
        set((s) => {
          const normalized = path.replace(/\/+$/, "");
          if (s.gitMonitorPaths.includes(normalized)) return s;
          if (s.gitMonitorPaths.length >= MAX_GIT_MONITOR_PATHS) {
            toast.error(`최대 ${MAX_GIT_MONITOR_PATHS}개까지 모니터링할 수 있습니다`);
            return s;
          }
          return { gitMonitorPaths: [...s.gitMonitorPaths, normalized] };
        }),
      removeGitMonitorPath: (path) =>
        set((s) => ({
          gitMonitorPaths: s.gitMonitorPaths.filter((p) => p !== path),
        })),
      pendingPrompt: null,
      pendingPromptSessionId: null,
      setPendingPrompt: (prompt, sessionId) =>
        set({ pendingPrompt: prompt, pendingPromptSessionId: sessionId }),
      clearPendingPrompt: () =>
        set({ pendingPrompt: null, pendingPromptSessionId: null }),
    }),
    {
      name: "rocket-session-store",
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version === 0) {
          const oldPath = state.gitMonitorPath as string | undefined;
          return {
            ...state,
            gitMonitorPaths: oldPath ? [oldPath] : [],
            gitMonitorPath: undefined,
          };
        }
        if (version === 1) {
          // v1→v2: 라우트 기반으로 전환된 뷰 boolean 제거
          const { dashboardView, costView, ...rest } = state;
          return rest;
        }
        if (version === 2) {
          // v2→v3: splitView boolean → viewMode enum
          const wasSplit = state.splitView as boolean | undefined;
          return {
            ...state,
            viewMode: wasSplit ? "split" : "dashboard",
            splitView: undefined,
          };
        }
        return state;
      },
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        viewMode: s.viewMode,
        gitMonitorPaths: s.gitMonitorPaths,
      }),
    },
  ),
);
