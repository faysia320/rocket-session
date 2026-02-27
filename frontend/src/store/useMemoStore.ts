import { create } from "zustand";
import { persist } from "zustand/middleware";

interface MemoState {
  isOpen: boolean;
  toggleMemo: () => void;
  setMemoOpen: (open: boolean) => void;
}

export const useMemoStore = create<MemoState>()(
  persist(
    (set) => ({
      isOpen: false,
      toggleMemo: () => set((s) => ({ isOpen: !s.isOpen })),
      setMemoOpen: (open) => set({ isOpen: open }),
    }),
    {
      name: "rocket-memo-store",
      partialize: (s) => ({ isOpen: s.isOpen }),
    },
  ),
);
