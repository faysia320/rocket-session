import { create } from 'zustand';

interface SessionState {
  activeSessionId: string | null;
  showFiles: boolean;
  setActiveSessionId: (id: string | null) => void;
  toggleFiles: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSessionId: null,
  showFiles: true,
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  toggleFiles: () => set((state) => ({ showFiles: !state.showFiles })),
}));
