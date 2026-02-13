import { useState, useEffect } from 'react';
import { X, FileCode, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sessionsApi } from '@/lib/api/sessions.api';

interface FileViewerProps {
  sessionId: string;
  filePath: string;
  tool: string;
  timestamp?: string;
  onClose: () => void;
}

export function FileViewer({ sessionId, filePath, tool, timestamp, onClose }: FileViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [sessionId, filePath]);

  const fileName = filePath.split(/[/\\]/).pop() ?? filePath;

  return (
    <div className="flex flex-col h-full bg-card border-l border-border overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-secondary min-h-[44px]">
        <FileCode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs text-foreground truncate" title={filePath}>
            {fileName}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
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
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onClose}
          aria-label="파일 뷰어 닫기"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* 경로 */}
      <div className="px-3 py-1.5 border-b border-border bg-muted/50">
        <div className="font-mono text-[10px] text-muted-foreground truncate" title={filePath}>
          {filePath}
        </div>
      </div>

      {/* 본문 */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="font-mono text-xs text-destructive mb-1">
              파일을 불러올 수 없습니다
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {error}
            </div>
          </div>
        ) : (
          <pre className="px-3 py-2 font-mono text-[11px] text-foreground/90 leading-[1.6] whitespace-pre-wrap break-all">
            {content}
          </pre>
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
