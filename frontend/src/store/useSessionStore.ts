import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";

const MAX_GIT_MONITOR_PATHS = 10;

interface SessionState {
  activeSessionId: string | null;
  focusedSessionId: string | null;
  splitView: boolean;
  dashboardView: boolean;
  costView: boolean;
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  gitMonitorPaths: string[];
  setActiveSessionId: (id: string | null) => void;
  setFocusedSessionId: (id: string | null) => void;
  setSplitView: (v: boolean) => void;
  toggleSplitView: () => void;
  setDashboardView: (v: boolean) => void;
  toggleDashboardView: () => void;
  setCostView: (v: boolean) => void;
  toggleCostView: () => void;
  toggleSidebar: () => void;
  setSidebarMobileOpen: (open: boolean) => void;
  addGitMonitorPath: (path: string) => void;
  removeGitMonitorPath: (path: string) => void;
  pendingPrompt: string | null;
  setPendingPrompt: (prompt: string) => void;
  clearPendingPrompt: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      activeSessionId: null,
      focusedSessionId: null,
      splitView: false,
      dashboardView: false,
      costView: false,
      sidebarCollapsed: false,
      sidebarMobileOpen: false,
      gitMonitorPaths: [],
      setActiveSessionId: (id) => set({ activeSessionId: id }),
      setFocusedSessionId: (id) => set({ focusedSessionId: id }),
      setSplitView: (v) => set({ splitView: v }),
      toggleSplitView: () =>
        set((state) => ({
          splitView: !state.splitView,
          ...(state.splitView ? {} : { dashboardView: false, costView: false }),
        })),
      setDashboardView: (v) => set({ dashboardView: v }),
      toggleDashboardView: () =>
        set((state) => ({
          dashboardView: !state.dashboardView,
          ...(state.dashboardView ? {} : { splitView: false, costView: false }),
        })),
      setCostView: (v) => set({ costView: v }),
      toggleCostView: () =>
        set((state) => ({
          costView: !state.costView,
          ...(state.costView ? {} : { dashboardView: false, splitView: false }),
        })),
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
      setPendingPrompt: (prompt) => set({ pendingPrompt: prompt }),
      clearPendingPrompt: () => set({ pendingPrompt: null }),
    }),
    {
      name: "rocket-session-store",
      version: 1,
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
        return state;
      },
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        splitView: s.splitView,
        dashboardView: s.dashboardView,
        costView: s.costView,
        gitMonitorPaths: s.gitMonitorPaths,
      }),
    },
  ),
);
