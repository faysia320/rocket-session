import { memo, useRef, useEffect } from "react";
import { Sparkles, Terminal } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { SlashCommand } from "../constants/slashCommands";

interface SlashCommandPopupProps {
  commands: SlashCommand[];
  activeIndex: number;
  onSelect: (cmd: SlashCommand) => void;
  onHover: (index: number) => void;
}

export const SlashCommandPopup = memo(function SlashCommandPopup({
  commands,
  activeIndex,
  onSelect,
  onHover,
}: SlashCommandPopupProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (commands.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 z-50">
      <div className="bg-popover border border-border rounded-md shadow-lg overflow-hidden">
        <ScrollArea className="max-h-[240px]" viewportClassName="max-h-[240px]">
          <div ref={listRef} role="listbox" className="p-1">
            {commands.map((cmd, idx) => {
              const Icon =
                cmd.icon ?? (cmd.source === "skill" ? Sparkles : Terminal);
              return (
                <div
                  key={cmd.id}
                  role="option"
                  aria-selected={idx === activeIndex}
                  data-active={idx === activeIndex}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-sm cursor-pointer transition-colors",
                    idx === activeIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted",
                  )}
                  onClick={() => onSelect(cmd)}
                  onMouseEnter={() => onHover(idx)}
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs font-semibold inline-flex items-center">
                      {cmd.label}
                      {cmd.source === "skill" ? (
                        <span className="ml-1.5 text-[9px] text-muted-foreground/60 font-normal">
                          skill
                        </span>
                      ) : null}
                    </div>
                    <div className="font-mono text-2xs text-muted-foreground truncate">
                      {cmd.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
});
