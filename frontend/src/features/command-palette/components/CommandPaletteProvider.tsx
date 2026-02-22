import { lazy, Suspense } from "react";
import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";
import { useCommandPaletteStore } from "@/store";

const CommandPalette = lazy(() =>
  import("./CommandPalette").then((m) => ({
    default: m.CommandPalette,
  })),
);

export function CommandPaletteProvider() {
  useGlobalShortcuts();
  const isOpen = useCommandPaletteStore((s) => s.isOpen);

  // CommandPalette 대화상자가 열릴 때만 lazy load
  return isOpen ? (
    <Suspense fallback={null}>
      <CommandPalette />
    </Suspense>
  ) : null;
}
