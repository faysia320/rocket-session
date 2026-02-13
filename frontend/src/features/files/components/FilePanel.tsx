import { useState, useCallback } from 'react';
import { ChevronRight, Maximize2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { DiffViewer } from './DiffViewer';
import { sessionsApi } from '@/lib/api/sessions.api';
import { cn, formatTime } from '@/lib/utils';
import { getToolBadgeStyle } from '../constants/toolColors';
import type { FileChange } from '@/types';

interface FilePanelProps {
  sessionId: string;
  fileChanges?: FileChange[];
  onFileClick?: (change: FileChange) => void;
}

export function FilePanel({ sessionId, fileChanges = [], onFileClick }: FilePanelProps) {
  return (
    <div className="flex flex-col overflow-hidden flex-1 min-h-0">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border">
        <span className="text-sm">{'\u{1F4C1}'}</span>
        <span className="font-mono text-xs font-semibold text-foreground flex-1">
          File Changes
        </span>
        <Badge variant="secondary" className="font-mono text-[10px]">
          {fileChanges.length}
        </Badge>
      </div>

      <ScrollArea className="flex-1 min-h-0 p-2">
        {fileChanges.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <div className="text-[28px] mb-2 opacity-40">{'\u{1F4C2}'}</div>
            <div className="font-mono text-xs text-muted-foreground mb-1">
              No file changes yet
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/70 leading-normal">
              Changes will appear here as Claude modifies files
            </div>
          </div>
        ) : (
          fileChanges.map((change, i) => (
            <FileChangeItem
              key={i}
              sessionId={sessionId}
              change={change}
              onFullView={onFileClick}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}

/** 절대 경로이면 마지막 3세그먼트로 축약, 상대 경로는 그대로 표시 */
function shortenFilePath(filePath: string): string {
  // Windows/Unix 절대 경로 감지
  const isAbsolute = /^[A-Z]:[/\\]/i.test(filePath) || filePath.startsWith('/');
  if (!isAbsolute) return filePath;
  const parts = filePath.split(/[/\\]/);
  if (parts.length <= 3) return filePath;
  return '.../' + parts.slice(-3).join('/');
}

interface FileChangeItemProps {
  sessionId: string;
  change: FileChange;
  onFullView?: (change: FileChange) => void;
}

function FileChangeItem({ sessionId, change, onFullView }: FileChangeItemProps) {
  const [open, setOpen] = useState(false);
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpenChange = useCallback(async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && diff === null) {
      setLoading(true);
      try {
        const result = await sessionsApi.fileDiff(sessionId, change.file);
        setDiff(result);
      } catch {
        setDiff('');
      } finally {
        setLoading(false);
      }
    }
  }, [sessionId, change.file, diff]);

  const handleFullView = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onFullView?.(change);
  }, [onFullView, change]);

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange} className="mb-1.5">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full text-left p-2 px-2.5 bg-secondary border border-border rounded-sm animate-[fadeIn_0.2s_ease] hover:border-primary/30 hover:bg-secondary/80 transition-colors cursor-pointer"
          aria-label={`Diff 보기: ${change.file}`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <ChevronRight
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
                open && 'rotate-90',
              )}
            />
            <Badge
              variant="outline"
              className="font-mono text-[10px]"
              style={getToolBadgeStyle(change.tool)}
            >
              {change.tool}
            </Badge>
            <span className="font-mono text-[10px] text-muted-foreground/70 ml-auto shrink-0">
              {formatTime(change.timestamp)}
            </span>
            <button
              type="button"
              className="ml-1 p-0.5 rounded hover:bg-muted transition-colors shrink-0"
              onClick={handleFullView}
              aria-label={`전체 보기: ${change.file}`}
              title="전체 보기"
            >
              <Maximize2 className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
          <div className="font-mono text-[11px] text-primary break-all pl-5" title={change.file}>
            {shortenFilePath(change.file)}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border border-t-0 border-border rounded-b-sm bg-background">
          <div className="max-h-[300px] overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : diff !== null ? (
              diff.trim() ? (
                <DiffViewer diff={diff} />
              ) : (
                <div className="flex items-center justify-center py-4">
                  <span className="font-mono text-xs text-muted-foreground">
                    변경사항 없음
                  </span>
                </div>
              )
            ) : null}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}