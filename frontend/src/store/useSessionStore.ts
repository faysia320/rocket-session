import { create } from 'zustand';

interface SessionState {
  activeSessionId: string | null;
  splitView: boolean;
  setActiveSessionId: (id: string | null) => void;
  setSplitView: (v: boolean) => void;
  toggleSplitView: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSessionId: null,
  splitView: false,
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setSplitView: (v) => set({ splitView: v }),
  toggleSplitView: () => set((state) => ({ splitView: !state.splitView })),
}));
