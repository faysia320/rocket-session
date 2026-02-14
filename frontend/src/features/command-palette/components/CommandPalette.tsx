import { useCallback } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { useCommandPalette } from "../hooks/useCommandPalette";
import { useCommandPaletteStore } from "@/store";
import { CATEGORY_LABELS } from "../types";
import type { PaletteCommand } from "../types";

export function CommandPalette() {
  const isOpen = useCommandPaletteStore((s) => s.isOpen);
  const close = useCommandPaletteStore((s) => s.close);
  const addRecent = useCommandPaletteStore((s) => s.addRecent);

  const { groupedCommands, recentCommands, categoryOrder } =
    useCommandPalette();

  const handleSelect = useCallback(
    (cmd: PaletteCommand) => {
      close();
      addRecent(cmd.id);
      requestAnimationFrame(() => cmd.action());
    },
    [close, addRecent],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) close();
    },
    [close],
  );

  return (
    <CommandDialog open={isOpen} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder="명령어 검색…"
        className="font-mono"
      />
      <CommandList className="max-h-[400px]">
        <CommandEmpty className="font-mono text-sm py-6 text-center">
          일치하는 명령어가 없습니다
        </CommandEmpty>

        {recentCommands.length > 0 ? (
          <>
            <CommandGroup heading="최근 사용">
              {recentCommands.map((cmd) => (
                <CommandItemRow
                  key={`recent:${cmd.id}`}
                  cmd={cmd}
                  onSelect={handleSelect}
                />
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}

        {categoryOrder.map((cat) => {
          const cmds = groupedCommands[cat];
          if (cmds.length === 0) return null;
          return (
            <CommandGroup
              key={cat}
              heading={CATEGORY_LABELS[cat]}
            >
              {cmds.map((cmd) => (
                <CommandItemRow
                  key={cmd.id}
                  cmd={cmd}
                  onSelect={handleSelect}
                />
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}

function CommandItemRow({
  cmd,
  onSelect,
}: {
  cmd: PaletteCommand;
  onSelect: (cmd: PaletteCommand) => void;
}) {
  const Icon = cmd.icon;
  const searchValue = [
    cmd.id,
    cmd.label,
    cmd.description,
    ...(cmd.keywords || []),
  ].join(" ");

  return (
    <CommandItem
      value={searchValue}
      onSelect={() => onSelect(cmd)}
      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex flex-col flex-1 min-w-0">
        <span className="font-mono text-sm truncate">{cmd.label}</span>
        <span className="font-mono text-xs text-muted-foreground truncate">
          {cmd.description}
        </span>
      </div>
      {cmd.shortcut ? (
        <kbd
          className="ml-auto shrink-0 font-mono text-2xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border"
          aria-hidden="true"
        >
          {cmd.shortcut}
        </kbd>
      ) : null}
    </CommandItem>
  );
}
