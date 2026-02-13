import { memo } from 'react';
import { FolderOpen, GitBranch } from 'lucide-react';
import { ModeIndicator } from './ModeIndicator';
import { SessionSettings } from '@/features/session/components/SessionSettings';
import { FilePanel } from '@/features/files/components/FilePanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { FileChange, SessionMode } from '@/types';

interface ChatHeaderProps {
  connected: boolean;
  workDir?: string;
  gitBranch?: string;
  mode: SessionMode;
  status: 'idle' | 'running';
  sessionId: string;
  fileChanges: FileChange[];
  onToggleMode: () => void;
  onFileClick: (change: FileChange) => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  filesOpen: boolean;
  onFilesOpenChange: (open: boolean) => void;
}

export const ChatHeader = memo(function ChatHeader({
  connected,
  workDir,
  gitBranch,
  mode,
  status,
  sessionId,
  fileChanges,
  onToggleMode,
  onFileClick,
  settingsOpen,
  onSettingsOpenChange,
  filesOpen,
  onFilesOpenChange,
}: ChatHeaderProps) {
  return (
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
        {workDir ? (
          <>
            <span className="text-muted-foreground/70 text-xs">|</span>
            <FolderOpen className="h-3 w-3 text-muted-foreground/70 shrink-0" />
            <span className="font-mono text-[11px] text-muted-foreground/70 truncate max-w-[300px] direction-rtl text-left" title={workDir}>
              {workDir}
            </span>
          </>
        ) : null}
        {gitBranch ? (
          <>
            <span className="text-muted-foreground/70 text-xs">|</span>
            <GitBranch className="h-3 w-3 text-muted-foreground/70 shrink-0" />
            <span className="font-mono text-[11px] text-muted-foreground/70">
              {gitBranch}
            </span>
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <ModeIndicator mode={mode} onToggle={onToggleMode} />
        {status === 'running' ? (
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary border-primary/20 font-mono text-[11px]"
          >
            <span className="inline-block w-2.5 h-2.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            Running
          </Badge>
        ) : null}
        <SessionSettings sessionId={sessionId} open={settingsOpen} onOpenChange={onSettingsOpenChange} />
        <Popover open={filesOpen} onOpenChange={onFilesOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              title="File changes"
              className={cn(filesOpen && 'bg-muted')}
              aria-label="파일 변경 패널"
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
            <FilePanel fileChanges={fileChanges} onFileClick={onFileClick} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
});
