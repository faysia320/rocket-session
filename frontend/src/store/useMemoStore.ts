import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Position {
  x: number;
  y: number;
}

interface MemoState {
  isOpen: boolean;
  position: Position | null;
  toggleMemo: () => void;
  setMemoOpen: (open: boolean) => void;
  setPosition: (pos: Position) => void;
}

export const useMemoStore = create<MemoState>()(
  persist(
    (set) => ({
      isOpen: false,
      position: null,
      toggleMemo: () => set((s) => ({ isOpen: !s.isOpen })),
      setMemoOpen: (open) => set({ isOpen: open }),
      setPosition: (pos) => set({ position: pos }),
    }),
    {
      name: "rocket-memo-store",
      partialize: (s) => ({ isOpen: s.isOpen, position: s.position }),
    },
  ),
);
