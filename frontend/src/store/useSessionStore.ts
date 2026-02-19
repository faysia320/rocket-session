import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionState {
  activeSessionId: string | null;
  focusedSessionId: string | null;
  splitView: boolean;
  dashboardView: boolean;
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  gitMonitorPath: string;
  setActiveSessionId: (id: string | null) => void;
  setFocusedSessionId: (id: string | null) => void;
  setSplitView: (v: boolean) => void;
  toggleSplitView: () => void;
  setDashboardView: (v: boolean) => void;
  toggleDashboardView: () => void;
  toggleSidebar: () => void;
  setSidebarMobileOpen: (open: boolean) => void;
  setGitMonitorPath: (path: string) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      activeSessionId: null,
      focusedSessionId: null,
      splitView: false,
      dashboardView: false,
      sidebarCollapsed: false,
      sidebarMobileOpen: false,
      gitMonitorPath: "",
      setActiveSessionId: (id) => set({ activeSessionId: id }),
      setFocusedSessionId: (id) => set({ focusedSessionId: id }),
      setSplitView: (v) => set({ splitView: v }),
      toggleSplitView: () =>
        set((state) => ({
          splitView: !state.splitView,
          ...(state.splitView ? {} : { dashboardView: false }),
        })),
      setDashboardView: (v) => set({ dashboardView: v }),
      toggleDashboardView: () =>
        set((state) => ({
          dashboardView: !state.dashboardView,
          ...(state.dashboardView ? {} : { splitView: false }),
        })),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
      setGitMonitorPath: (path) => set({ gitMonitorPath: path }),
    }),
    {
      name: "rocket-session-store",
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        splitView: s.splitView,
        dashboardView: s.dashboardView,
        gitMonitorPath: s.gitMonitorPath,
      }),
    },
  ),
);
