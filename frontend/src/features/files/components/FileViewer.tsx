import { useState, useEffect } from 'react';
import { FileCode, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { sessionsApi } from '@/lib/api/sessions.api';

interface FileViewerProps {
  sessionId: string;
  filePath: string;
  tool: string;
  timestamp?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FileViewer({ sessionId, filePath, tool, timestamp, open, onOpenChange }: FileViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setContent(null);

    sessionsApi
      .fileContent(sessionId, filePath)
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [sessionId, filePath, open]);

  const fileName = filePath.split(/[/\\]/).pop() ?? filePath;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col bg-card border-border p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border bg-secondary">
          <div className="flex items-center gap-2">
            <FileCode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <DialogTitle className="font-mono text-xs text-foreground truncate" title={filePath}>
              {fileName}
            </DialogTitle>
          </div>
          <DialogDescription className="flex items-center gap-1.5 mt-0.5">
            <Badge
              variant="outline"
              className="font-mono text-[9px] px-1 py-0"
              style={{
                background:
                  tool === 'Write'
                    ? 'rgba(34,197,94,0.15)'
                    : tool === 'Edit'
                      ? 'rgba(59,130,246,0.15)'
                      : 'rgba(148,163,184,0.15)',
                color:
                  tool === 'Write'
                    ? 'hsl(var(--success))'
                    : tool === 'Edit'
                      ? 'hsl(var(--info))'
                      : 'hsl(var(--muted-foreground))',
              }}
            >
              {tool}
            </Badge>
            {timestamp ? (
              <span className="font-mono text-[9px] text-muted-foreground/70">
                {formatTime(timestamp)}
              </span>
            ) : null}
            <span className="font-mono text-[10px] text-muted-foreground truncate ml-1" title={filePath}>
              {filePath}
            </span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="font-mono text-xs text-destructive mb-1">
                {'\uD30C\uC77C\uC744 \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4'}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {error}
              </div>
            </div>
          ) : (
            <pre className="px-4 py-3 font-mono text-[11px] text-foreground/90 leading-[1.6] whitespace-pre-wrap break-all">
              {content}
            </pre>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
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
