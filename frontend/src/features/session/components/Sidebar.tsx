import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { SessionInfo } from '@/types';

interface SidebarProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: (workDir?: string) => void;
  onDelete: (id: string) => void;
}

export function Sidebar({ sessions, activeSessionId, onSelect, onNew, onDelete }: SidebarProps) {
  const [workDir, setWorkDir] = useState('');
  const [showInput, setShowInput] = useState(false);

  const handleCreate = () => {
    onNew(workDir || undefined);
    setWorkDir('');
    setShowInput(false);
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
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <div className="flex gap-1.5">
              <Button variant="default" size="sm" className="flex-1 h-8" onClick={handleCreate}>
                Create
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8"
                onClick={() => setShowInput(false)}
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
        <div className="font-mono text-[11px] text-muted-foreground">Claude Code CLI</div>
        <div className="font-mono text-[10px] text-muted-foreground/70">Dashboard v1.0</div>
      </div>
    </aside>
  );
}

function truncatePath(p: string): string {
  if (!p) return '~';
  const parts = p.split(/[/\\]/);
  if (parts.length <= 3) return p;
  return '~/' + parts.slice(-2).join('/');
}
