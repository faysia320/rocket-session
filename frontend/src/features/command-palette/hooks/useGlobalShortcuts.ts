import { useEffect } from "react";
import { useCommandPaletteStore, useMemoStore } from "@/store";
import { useSessionStore } from "@/store";

export function useGlobalShortcuts() {
  const togglePalette = useCommandPaletteStore((s) => s.toggle);
  const toggleSidebar = useSessionStore((s) => s.toggleSidebar);
  const toggleMemo = useMemoStore((s) => s.toggleMemo);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd+K / Ctrl+K → 커맨드 팔레트 토글
      if (mod && e.key === "k") {
        e.preventDefault();
        togglePalette();
        return;
      }

      // Cmd+B / Ctrl+B → 사이드바 토글
      if (mod && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // Cmd+M / Ctrl+M → 메모 토글
      if (mod && e.key === "m") {
        e.preventDefault();
        toggleMemo();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePalette, toggleSidebar, toggleMemo]);
}
