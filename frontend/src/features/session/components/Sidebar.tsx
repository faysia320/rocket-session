import { useState } from 'react';
import { useTheme } from 'next-themes';
import { ChevronDown, ChevronUp, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { SessionInfo } from '@/types';

interface SidebarProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: (workDir?: string, options?: { allowed_tools?: string; system_prompt?: string; timeout_seconds?: number }) => void;
  onDelete: (id: string) => void;
}

export function Sidebar({ sessions, activeSessionId, onSelect, onNew, onDelete }: SidebarProps) {
  const [workDir, setWorkDir] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [timeoutMinutes, setTimeoutMinutes] = useState('');

  const handleCreate = () => {
    const options: { system_prompt?: string; timeout_seconds?: number } = {};
    if (systemPrompt.trim()) {
      options.system_prompt = systemPrompt.trim();
    }
    if (timeoutMinutes && Number(timeoutMinutes) > 0) {
      options.timeout_seconds = Number(timeoutMinutes) * 60;
    }
    onNew(workDir || undefined, Object.keys(options).length > 0 ? options : undefined);
    setWorkDir('');
    setSystemPrompt('');
    setTimeoutMinutes('');
    setShowInput(false);
    setShowAdvanced(false);
  };

  const handleCancel = () => {
    setShowInput(false);
    setShowAdvanced(false);
    setWorkDir('');
    setSystemPrompt('');
    setTimeoutMinutes('');
  };

  return (
    <aside className="w-[260px] min-w-[260px] h-screen flex flex-col bg-card border-r border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-lg text-primary">{'\u25C6'}</span>
          <span className="font-mono text-sm font-semibold text-foreground tracking-tight">
            CC Dashboard
          </span>
        </div>
      </div>

      {/* New Session */}
      <div className="px-3 pt-3">
        {showInput ? (
          <div className="flex flex-col gap-2">
            <Input
              className="font-mono text-xs"
              placeholder="Working directory (optional)"
              value={workDir}
              onChange={(e) => setWorkDir(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !showAdvanced && handleCreate()}
              autoFocus
            />

            {/* 고급 설정 토글 */}
            <button
              type="button"
              className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowAdvanced((p) => !p)}
            >
              {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Advanced Settings
            </button>

            {showAdvanced ? (
              <div className="flex flex-col gap-2 pl-1">
                <Textarea
                  className="font-mono text-[10px] min-h-[60px] bg-input border-border"
                  placeholder="System prompt (optional)"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                />
                <Input
                  className="font-mono text-[10px] w-full"
                  type="number"
                  min="1"
                  placeholder="Timeout (minutes, optional)"
                  value={timeoutMinutes}
                  onChange={(e) => setTimeoutMinutes(e.target.value)}
                />
              </div>
            ) : null}

            <div className="flex gap-1.5">
              <Button variant="default" size="sm" className="flex-1 h-8" onClick={handleCreate}>
                Create
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="default"
            className="w-full flex items-center gap-2 px-3 py-2.5 font-mono text-[13px] font-semibold"
            onClick={() => setShowInput(true)}
          >
            <span className="text-base font-bold">+</span>
            New Session
          </Button>
        )}
      </div>

      {/* Sessions list header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="font-mono text-[10px] font-semibold text-muted-foreground tracking-widest">
          SESSIONS
        </span>
        <Badge variant="secondary" className="font-mono text-[10px]">
          {sessions.length}
        </Badge>
      </div>

      {/* Sessions list */}
      <ScrollArea className="flex-1 px-2">
        {sessions.length === 0 ? (
          <div className="py-6 px-3 text-center font-mono text-xs text-muted-foreground/70">
            No active sessions
          </div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className={cn(
                'px-3 py-2.5 rounded-sm cursor-pointer mb-1 transition-all border border-transparent',
                s.id === activeSessionId && 'bg-muted border-[hsl(var(--border-bright))]',
              )}
              onClick={() => onSelect(s.id)}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    s.status === 'running' && 'bg-green-500',
                    s.status === 'error' && 'bg-red-500',
                    s.status !== 'running' && s.status !== 'error' && 'bg-muted-foreground',
                  )}
                />
                <span className="font-mono text-[13px] font-medium text-foreground flex-1">
                  {s.id}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-5 h-5 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(s.id);
                  }}
                  aria-label="세션 삭제"
                >
                  {'\u00D7'}
                </Button>
              </div>
              <div className="flex items-center gap-1 mb-0.5">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {s.message_count} msgs
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/70">
                  {'\u00B7'}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {s.file_changes_count} changes
                </span>
              </div>
              <div
                className="font-mono text-[10px] text-muted-foreground/70 truncate"
                title={s.work_dir}
              >
                {truncatePath(s.work_dir)}
              </div>
            </div>
          ))
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[11px] text-muted-foreground">Claude Code CLI</div>
            <div className="font-mono text-[10px] text-muted-foreground/70">Dashboard v1.0</div>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="테마 변경"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function truncatePath(p: string): string {
  if (!p) return '~';
  const parts = p.split(/[/\\]/);
  if (parts.length <= 3) return p;
  return '~/' + parts.slice(-2).join('/');
}
