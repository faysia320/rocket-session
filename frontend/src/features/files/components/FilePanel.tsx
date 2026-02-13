import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { FileChange } from '@/types';

export function FilePanel({ fileChanges = [] }: { fileChanges?: FileChange[] }) {
  return (
    <div className="w-[280px] min-w-[280px] flex flex-col bg-card border-l border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-border bg-secondary">
        <span className="text-sm">{'\u{1F4C1}'}</span>
        <span className="font-mono text-xs font-semibold text-foreground flex-1">
          File Changes
        </span>
        <Badge variant="secondary" className="font-mono text-[10px]">
          {fileChanges.length}
        </Badge>
      </div>

      <ScrollArea className="flex-1 p-2">
        {fileChanges.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
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
            <div
              key={i}
              className="p-2 px-2.5 bg-secondary border border-border rounded-sm mb-1.5 animate-[fadeIn_0.2s_ease]"
            >
              <div className="flex items-center justify-between mb-1">
                <Badge
                  variant={
                    change.tool === 'Write'
                      ? 'default'
                      : change.tool === 'Edit'
                        ? 'secondary'
                        : 'outline'
                  }
                  className="font-mono text-[10px]"
                  style={{
                    background:
                      change.tool === 'Write'
                        ? 'rgba(34,197,94,0.15)'
                        : change.tool === 'Edit'
                          ? 'rgba(59,130,246,0.15)'
                          : 'rgba(148,163,184,0.15)',
                    color:
                      change.tool === 'Write'
                        ? 'hsl(var(--success))'
                        : change.tool === 'Edit'
                          ? 'hsl(var(--info))'
                          : 'hsl(var(--muted-foreground))',
                  }}
                >
                  {change.tool}
                </Badge>
                <span className="font-mono text-[10px] text-muted-foreground/70">
                  {formatTime(change.timestamp)}
                </span>
              </div>
              <div className="font-mono text-[11px] text-primary break-all">
                {change.file}
              </div>
            </div>
          ))
        )}
      </ScrollArea>
    </div>
  );
}

function formatTime(ts?: string): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}
