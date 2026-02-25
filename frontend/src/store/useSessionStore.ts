import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewMode = "dashboard" | "single" | "split";

interface SessionState {
  activeSessionId: string | null;
  focusedSessionId: string | null;
  viewMode: ViewMode;
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  setActiveSessionId: (id: string | null) => void;
  setFocusedSessionId: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleSidebar: () => void;
  setSidebarMobileOpen: (open: boolean) => void;
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
      setActiveSessionId: (id) => set({ activeSessionId: id }),
      setFocusedSessionId: (id) => set({ focusedSessionId: id }),
      setViewMode: (mode) => set({ viewMode: mode }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
      pendingPrompt: null,
      pendingPromptSessionId: null,
      setPendingPrompt: (prompt, sessionId) =>
        set({ pendingPrompt: prompt, pendingPromptSessionId: sessionId }),
      clearPendingPrompt: () => set({ pendingPrompt: null, pendingPromptSessionId: null }),
    }),
    {
      name: "rocket-session-store",
      version: 4,
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
          const { dashboardView: _dashboardView, costView: _costView, ...rest } = state;
          return rest;
        }
        if (version === 2) {
          const wasSplit = state.splitView as boolean | undefined;
          return {
            ...state,
            viewMode: wasSplit ? "split" : "dashboard",
            splitView: undefined,
          };
        }
        if (version === 3) {
          // v3→v4: gitMonitorPaths 제거 (워크스페이스로 통합)
          const { gitMonitorPaths: _gitMonitorPaths, ...rest } = state;
          return rest;
        }
        return state;
      },
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        viewMode: s.viewMode,
      }),
    },
  ),
);
