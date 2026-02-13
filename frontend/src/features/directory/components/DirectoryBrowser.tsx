import { useState } from 'react';
import { Folder, FolderGit2, ArrowUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useDirectoryBrowser } from '../hooks/useDirectoryBrowser';
import type { DirectoryEntry } from '@/types';

interface DirectoryBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPath: string;
  onSelect: (path: string) => void;
}

export function DirectoryBrowser({ open, onOpenChange, initialPath, onSelect }: DirectoryBrowserProps) {
  const { currentPath, entries, parent, isLoading, navigateTo, goUp } = useDirectoryBrowser(initialPath || '~');
  const [selected, setSelected] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState('');

  const handleNavigate = () => {
    if (pathInput.trim()) {
      navigateTo(pathInput.trim());
      setPathInput('');
    }
  };

  const handleEntryClick = (entry: DirectoryEntry) => {
    setSelected(entry.path);
  };

  const handleEntryDoubleClick = (entry: DirectoryEntry) => {
    if (entry.is_dir) {
      navigateTo(entry.path);
      setSelected(null);
    }
  };

  const handleConfirm = () => {
    onSelect(selected ?? currentPath);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">디렉토리 선택</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="font-mono text-[10px] text-muted-foreground truncate" title={currentPath}>
            현재: {currentPath}
          </div>

          <div className="flex gap-1.5">
            <Input
              className="font-mono text-xs flex-1"
              placeholder="경로 입력…"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
            />
            <Button variant="outline" size="sm" onClick={handleNavigate}>
              이동
            </Button>
          </div>

          <ScrollArea className="h-[300px] border border-border rounded-md">
            <div className="p-1">
              {parent ? (
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted text-left"
                  onClick={goUp}
                >
                  <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs text-muted-foreground">상위 디렉토리</span>
                </button>
              ) : null}

              {isLoading ? (
                <div className="py-8 text-center font-mono text-xs text-muted-foreground">
                  불러오는 중…
                </div>
              ) : entries.length === 0 ? (
                <div className="py-8 text-center font-mono text-xs text-muted-foreground">
                  하위 디렉토리 없음
                </div>
              ) : (
                entries.map((entry) => (
                  <button
                    key={entry.path}
                    type="button"
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-left transition-colors',
                      selected === entry.path ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                    )}
                    onClick={() => handleEntryClick(entry)}
                    onDoubleClick={() => handleEntryDoubleClick(entry)}
                  >
                    {entry.is_git_repo ? (
                      <FolderGit2 className="h-3.5 w-3.5 text-info shrink-0" />
                    ) : (
                      <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-mono text-xs truncate">{entry.name}</span>
                    {entry.is_git_repo ? (
                      <span className="font-mono text-[9px] text-info/70 ml-auto shrink-0">(git)</span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            선택
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
