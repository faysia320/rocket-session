import { useState, useRef, useEffect } from 'react';
import { FolderOpen, Send, Square } from 'lucide-react';
import { useClaudeSocket } from '../hooks/useClaudeSocket';
import { MessageBubble } from './MessageBubble';
import { SessionSettings } from '@/features/session/components/SessionSettings';
import { FilePanel } from '@/features/files/components/FilePanel';
import { FileViewer } from '@/features/files/components/FileViewer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { FileChange } from '@/types';
import { useSlashCommands } from '../hooks/useSlashCommands';
import { SlashCommandPopup } from './SlashCommandPopup';
import type { SlashCommand } from '../constants/slashCommands';

interface ChatPanelProps {
  sessionId: string;
}

export function ChatPanel({ sessionId }: ChatPanelProps) {
  const { connected, messages, status, sessionInfo, fileChanges, sendPrompt, stopExecution, clearMessages, addSystemMessage } =
    useClaudeSocket(sessionId);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const slashCommands = useSlashCommands({
    connected,
    isRunning: status === 'running',
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileClick = (change: FileChange) => {
    setSelectedFile(change);
    setFilesOpen(false);
  };

  const executeSlashCommand = (cmd: SlashCommand) => {
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
    switch (cmd.id) {
      case 'help': {
        const helpText =
          '\uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uBA85\uB839\uC5B4:\n' +
          '  /help     - \uBA85\uB839\uC5B4 \uBAA9\uB85D \uD45C\uC2DC\n' +
          '  /clear    - \uB300\uD654 \uB0B4\uC5ED \uCD08\uAE30\uD654\n' +
          '  /compact  - \uCEE8\uD14D\uC2A4\uD2B8 \uC555\uCD95 (CLI \uC804\uB2EC)\n' +
          '  /model    - \uBAA8\uB378 \uBCC0\uACBD (CLI \uC804\uB2EC)\n' +
          '  /settings - \uC138\uC158 \uC124\uC815 \uC5F4\uAE30\n' +
          '  /files    - \uD30C\uC77C \uBCC0\uACBD \uD328\uB110 \uD1A0\uAE00';
        addSystemMessage(helpText);
        break;
      }
      case 'clear':
        clearMessages();
        break;
      case 'compact':
      case 'model':
        sendPrompt(`/${cmd.id}`);
        break;
      case 'settings':
        setSettingsOpen(true);
        break;
      case 'files':
        setFilesOpen((p) => !p);
        break;
    }
  };

  const handleSubmit = () => {
    const prompt = input.trim();
    if (!prompt || status === 'running') return;
    sendPrompt(prompt);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashCommands.isOpen) {
      const selected = slashCommands.handleKeyDown(e);
      if (selected) {
        executeSlashCommand(slashCommands.selectCommand(selected));
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    slashCommands.handleInputChange(val);
    e.target.style.height = '44px';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* \uC0C1\uB2E8\uBC14 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary min-h-[44px]">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-[7px] h-[7px] rounded-full transition-all',
              connected
                ? 'bg-success shadow-[0_0_8px_hsl(var(--success))]'
                : 'bg-destructive'
            )}
          />
          <span className="font-mono text-xs text-muted-foreground">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          {sessionInfo?.claude_session_id ? (
            <>
              <span className="text-muted-foreground/70 text-xs">|</span>
              <span className="font-mono text-[11px] text-muted-foreground/70">
                Claude Session: {sessionInfo.claude_session_id.slice(0, 12)}{'\u2026'}
              </span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {status === 'running' ? (
            <Badge
              variant="outline"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary border-primary/20 font-mono text-[11px]"
            >
              <span className="inline-block w-2.5 h-2.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              Running
            </Badge>
          ) : null}
          <SessionSettings sessionId={sessionId} open={settingsOpen} onOpenChange={setSettingsOpen} />
          <Popover open={filesOpen} onOpenChange={setFilesOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                title="File changes"
                className={cn(filesOpen && 'bg-muted')}
                aria-label="\uD30C\uC77C \uBCC0\uACBD \uD328\uB110"
              >
                <FolderOpen className="h-4 w-4" />
                {fileChanges.length > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {fileChanges.length > 99 ? '99+' : fileChanges.length}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0 bg-card border-border" align="end">
              <FilePanel fileChanges={fileChanges} onFileClick={handleFileClick} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* \uBA54\uC2DC\uC9C0 \uC601\uC5ED */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-2">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-50">
            <div className="font-mono text-[32px] text-primary animate-[blink_1.2s_ease-in-out_infinite]">
              {'>'}_
            </div>
            <div className="font-mono text-[13px] text-muted-foreground">
              Send a prompt to start working with Claude Code
            </div>
          </div>
        ) : null}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* \uC785\uB825 \uC601\uC5ED */}
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
          <Textarea
            ref={textareaRef}
            className="flex-1 font-mono text-[13px] bg-transparent border-0 outline-none resize-none min-h-[44px] leading-[22px] py-[11px] focus-visible:ring-0 focus-visible:ring-offset-0"
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Enter a prompt for Claude Code\u2026"
            rows={1}
            disabled={!connected}
          />
          <div className="flex items-center pb-1">
            {status === 'running' ? (
              <Button variant="destructive" size="sm" onClick={stopExecution} className="font-mono text-xs font-semibold">
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
          Shift+Enter \uC904\uBC14\uAFC8 {'\u00B7'} <span className="text-muted-foreground">/</span> \uBA85\uB839\uC5B4
        </div>
      </div>

      {/* FileViewer Dialog */}
      {selectedFile ? (
        <FileViewer
          sessionId={sessionId}
          filePath={selectedFile.file}
          tool={selectedFile.tool}
          timestamp={selectedFile.timestamp}
          open={!!selectedFile}
          onOpenChange={(open) => { if (!open) setSelectedFile(null); }}
        />
      ) : null}
    </div>
  );
}
