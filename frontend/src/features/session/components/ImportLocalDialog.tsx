import { useState, useEffect } from 'react';
import { Download, Loader2, GitBranch, MessageSquare, FolderOpen } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { localSessionsApi } from '@/lib/api/local-sessions.api';
import type { LocalSessionMeta } from '@/types';

interface ImportLocalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (dashboardSessionId: string) => void;
}

export function ImportLocalDialog({ open, onOpenChange, onImported }: ImportLocalDialogProps) {
  const [sessions, setSessions] = useState<LocalSessionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    localSessionsApi
      .scan()
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open]);

  const handleImport = async (meta: LocalSessionMeta) => {
    setImporting(meta.session_id);
    try {
      const result = await localSessionsApi.import({
        session_id: meta.session_id,
        project_dir: meta.project_dir,
      });
      setSessions((prev) =>
        prev.map((s) =>
          s.session_id === meta.session_id ? { ...s, already_imported: true } : s,
        ),
      );
      onImported(result.dashboard_session_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import fail');
    } finally {
      setImporting(null);
    }
  };

  const grouped = sessions.reduce<Record<string, LocalSessionMeta[]>>((acc, s) => {
    const key = s.cwd || s.project_dir;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm flex items-center gap-2">
            <Download className="h-4 w-4" />
            Import Local Sessions
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-8 text-center font-mono text-xs text-destructive">{error}</div>
        ) : sessions.length === 0 ? (
          <div className="py-8 text-center font-mono text-xs text-muted-foreground">
            No local sessions found
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="flex flex-col gap-4 pb-2">
              {Object.entries(grouped).map(([cwd, items]) => (
                <div key={cwd}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <FolderOpen className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono text-[10px] text-muted-foreground truncate" title={cwd}>
                      {truncateCwd(cwd)}
                    </span>
                    <Badge variant="secondary" className="font-mono text-[9px] ml-auto">
                      {items.length}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    {items.map((s) => (
                      <SessionRow
                        key={s.session_id}
                        meta={s}
                        importing={importing === s.session_id}
                        onImport={() => handleImport(s)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SessionRow({
  meta,
  importing,
  onImport,
}: {
  meta: LocalSessionMeta;
  importing: boolean;
  onImport: () => void;
}) {
  const displayName = meta.slug || meta.session_id.slice(0, 8);
  const date = meta.last_timestamp
    ? new Date(meta.last_timestamp).toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2.5 py-2 rounded-sm border border-border bg-card/50',
        meta.already_imported && 'opacity-60',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] font-medium text-foreground truncate">
            {displayName}
          </span>
          {meta.already_imported ? (
            <Badge variant="secondary" className="font-mono text-[9px] shrink-0">
              Imported
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {meta.git_branch ? (
            <span className="flex items-center gap-0.5 font-mono text-[9px] text-muted-foreground">
              <GitBranch className="h-2.5 w-2.5" />
              {meta.git_branch}
            </span>
          ) : null}
          <span className="flex items-center gap-0.5 font-mono text-[9px] text-muted-foreground">
            <MessageSquare className="h-2.5 w-2.5" />
            {meta.message_count}
          </span>
          {date ? (
            <span className="font-mono text-[9px] text-muted-foreground">{date}</span>
          ) : null}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 font-mono text-[10px] shrink-0"
        disabled={meta.already_imported || importing}
        onClick={onImport}
        aria-label={`${displayName} import`}
      >
        {importing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : meta.already_imported ? (
          'Done'
        ) : (
          'Import'
        )}
      </Button>
    </div>
  );
}

function truncateCwd(p: string): string {
  if (!p) return '~';
  const parts = p.split(/[/\\]/);
  if (parts.length <= 3) return p;
  return '~/' + parts.slice(-2).join('/');
}
