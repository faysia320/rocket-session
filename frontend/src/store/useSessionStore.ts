import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SessionState {
  activeSessionId: string | null;
  splitView: boolean;
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  setActiveSessionId: (id: string | null) => void;
  setSplitView: (v: boolean) => void;
  toggleSplitView: () => void;
  toggleSidebar: () => void;
  setSidebarMobileOpen: (open: boolean) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      activeSessionId: null,
      splitView: false,
      sidebarCollapsed: false,
      sidebarMobileOpen: false,
      setActiveSessionId: (id) => set({ activeSessionId: id }),
      setSplitView: (v) => set({ splitView: v }),
      toggleSplitView: () => set((state) => ({ splitView: !state.splitView })),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
    }),
    {
      name: 'rocket-session-store',
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        splitView: s.splitView,
      }),
    },
  ),
);
