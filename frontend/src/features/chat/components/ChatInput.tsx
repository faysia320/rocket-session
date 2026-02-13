import { memo, useState, useRef, useCallback } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SlashCommandPopup } from './SlashCommandPopup';
import type { SessionMode } from '@/types';
import type { SlashCommand } from '../constants/slashCommands';
import type { useSlashCommands } from '../hooks/useSlashCommands';

interface ChatInputProps {
  connected: boolean;
  status: 'idle' | 'running';
  mode: SessionMode;
  slashCommands: ReturnType<typeof useSlashCommands>;
  onSubmit: (prompt: string) => void;
  onStop: () => void;
  onModeToggle: () => void;
  onSlashCommand: (cmd: SlashCommand) => void;
}

export const ChatInput = memo(function ChatInput({
  connected,
  status,
  mode,
  slashCommands,
  onSubmit,
  onStop,
  onModeToggle,
  onSlashCommand,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resetTextarea = useCallback(() => {
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  }, []);

  const handleSubmit = useCallback(() => {
    const prompt = input.trim();
    if (!prompt || status === 'running') return;
    onSubmit(prompt);
    resetTextarea();
  }, [input, status, onSubmit, resetTextarea]);

  const executeSlashCommand = useCallback((cmd: SlashCommand) => {
    resetTextarea();
    onSlashCommand(cmd);
  }, [resetTextarea, onSlashCommand]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashCommands.isOpen) {
      const selected = slashCommands.handleKeyDown(e);
      if (selected) {
        executeSlashCommand(slashCommands.selectCommand(selected));
      }
      return;
    }
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      onModeToggle();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [slashCommands, onModeToggle, handleSubmit, executeSlashCommand]);

  const handleTextareaInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    slashCommands.handleInputChange(val);
    e.target.style.height = '44px';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  }, [slashCommands]);

  return (
    <div className="px-4 py-3 border-t border-border bg-secondary">
      <div className="relative">
        {slashCommands.isOpen ? (
          <SlashCommandPopup
            commands={slashCommands.filteredCommands}
            activeIndex={slashCommands.activeIndex}
            onSelect={(cmd) => executeSlashCommand(slashCommands.selectCommand(cmd))}
            onHover={slashCommands.setActiveIndex}
          />
        ) : null}
        <div className="flex items-end gap-2 bg-input border border-border rounded-[var(--radius-md)] pl-3.5 pr-1 py-1 transition-colors focus-within:border-primary/50">
          {mode === 'plan' ? (
            <button
              type="button"
              onClick={onModeToggle}
              className="flex items-center self-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-all duration-200 cursor-pointer shrink-0"
              title="Plan 모드 (Shift+Tab으로 전환)"
            >
              Plan
            </button>
          ) : null}
          <Textarea
            ref={textareaRef}
            className="flex-1 font-mono text-[13px] bg-transparent border-0 outline-none resize-none min-h-[44px] leading-[22px] py-[11px] focus-visible:ring-0 focus-visible:ring-offset-0"
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Enter a prompt for Claude Code…"
            rows={1}
            disabled={!connected}
          />
          <div className="flex items-center pb-1">
            {status === 'running' ? (
              <Button variant="destructive" size="sm" onClick={onStop} className="font-mono text-xs font-semibold">
                <Square className="h-3 w-3 mr-1.5 fill-current" />
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!input.trim() || !connected}
                className="font-mono text-xs font-semibold"
              >
                Send <Send className="h-3 w-3 ml-1.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="font-mono text-[10px] text-muted-foreground/70 mt-1.5 pl-0.5">
        Shift+Enter 줄바꿈 {'·'} Shift+Tab 모드 전환 {'·'} <span className="text-muted-foreground">/</span> 명령어
      </div>
    </div>
  );
});
