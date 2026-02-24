import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AgentState } from "../types/office";

interface OfficeState {
  agents: AgentState[];
  hoveredAgentId: string | null;
  zoom: number;
  showLabels: boolean;

  setAgents: (agents: AgentState[]) => void;
  setHoveredAgent: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  adjustZoom: (delta: number) => void;
  toggleLabels: () => void;
}

export const useOfficeStore = create<OfficeState>()(
  persist(
    (set) => ({
      agents: [],
      hoveredAgentId: null,
      zoom: 3,
      showLabels: true,

      setAgents: (agents) => set({ agents }),
      setHoveredAgent: (id) => set({ hoveredAgentId: id }),
      setZoom: (zoom) => set({ zoom: Math.max(1, Math.min(5, Math.round(zoom))) }),
      adjustZoom: (delta) =>
        set((s) => ({ zoom: Math.max(1, Math.min(5, Math.round(s.zoom + delta))) })),
      toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
    }),
    {
      name: "rocket-office-store",
      version: 1,
      partialize: (s) => ({
        zoom: s.zoom,
        showLabels: s.showLabels,
      }),
    },
  ),
);
