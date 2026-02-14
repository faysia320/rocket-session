import { CommandPalette } from "./CommandPalette";
import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";

export function CommandPaletteProvider() {
  useGlobalShortcuts();
  return <CommandPalette />;
}
