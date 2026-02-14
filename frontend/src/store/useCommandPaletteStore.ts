import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CommandPaletteState {
  isOpen: boolean;
  recentCommandIds: string[];
  open: () => void;
  close: () => void;
  toggle: () => void;
  addRecent: (commandId: string) => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>()(
  persist(
    (set) => ({
      isOpen: false,
      recentCommandIds: [],
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      addRecent: (commandId) =>
        set((s) => ({
          recentCommandIds: [
            commandId,
            ...s.recentCommandIds.filter((id) => id !== commandId),
          ].slice(0, 5),
        })),
    }),
    {
      name: "rocket-command-palette",
      partialize: (s) => ({ recentCommandIds: s.recentCommandIds }),
    },
  ),
);
