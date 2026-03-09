import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Position {
  x: number;
  y: number;
}

interface Size {
  w: number;
  h: number;
}

interface PreviewState {
  isOpen: boolean;
  url: string;
  position: Position | null;
  size: Size;
  openPreview: (url: string) => void;
  closePreview: () => void;
  setUrl: (url: string) => void;
  setPosition: (pos: Position) => void;
  setSize: (size: Size) => void;
}

export const usePreviewStore = create<PreviewState>()(
  persist(
    (set) => ({
      isOpen: false,
      url: "",
      position: null,
      size: { w: 640, h: 480 },
      openPreview: (url) => set({ isOpen: true, url }),
      closePreview: () => set({ isOpen: false }),
      setUrl: (url) => set({ url }),
      setPosition: (pos) => set({ position: pos }),
      setSize: (size) => set({ size }),
    }),
    {
      name: "rocket-preview-store",
      partialize: (s) => ({ position: s.position, size: s.size }),
    },
  ),
);
