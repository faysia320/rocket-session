import { useState } from 'react';
import { ChevronDown, ChevronRight, GitBranch, Plus, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useWorktrees } from '../hooks/useWorktrees';

interface WorktreePanelProps {
  repoPath: string;
  onChange: (path: string) => void;
}

export function WorktreePanel({ repoPath, onChange }: WorktreePanelProps) {
  const { worktrees, isLoading, createWorktree, isCreating } = useWorktrees(repoPath);
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [createBranch, setCreateBranch] = useState(true);

  const handleCreate = async () => {
    if (!branchName.trim()) return;
    try {
      const result = await createWorktree({
        repo_path: repoPath,
        branch: branchName.trim(),
        create_branch: createBranch,
      });
      onChange(result.path);
      setBranchName('');
      setShowForm(false);
    } catch {
      // 에러는 mutation에서 처리
    }
  };

  if (isLoading || worktrees.length === 0) return null;

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setExpanded((p) => !p)}
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <GitBranch className="h-3 w-3 text-info" />
        <span className="font-mono text-[10px] font-semibold text-muted-foreground">
          Worktrees ({worktrees.length})
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-border px-1 py-1 space-y-0.5">
          {worktrees.map((wt) => (
            <button
              key={wt.path}
              type="button"
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded-sm hover:bg-muted text-left"
              onClick={() => onChange(wt.path)}
              title={wt.path}
            >
              {wt.is_main ? (
                <Star className="h-2.5 w-2.5 text-warning shrink-0" />
              ) : (
                <div className="w-2.5" />
              )}
              <span className="font-mono text-[10px] text-muted-foreground truncate flex-1">
                {wt.path}
              </span>
              <span className="font-mono text-[10px] text-info shrink-0">
                ({wt.branch ?? 'detached'})
              </span>
            </button>
          ))}

          {showForm ? (
            <div className="px-2 py-1.5 space-y-1.5 border-t border-border">
              <Input
                className="font-mono text-[10px] h-7"
                placeholder="브랜치명"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={createBranch}
                  onCheckedChange={(v) => setCreateBranch(v === true)}
                  className="h-3 w-3"
                />
                <span className="font-mono text-[10px] text-muted-foreground">새 브랜치 생성</span>
              </label>
              <div className="flex gap-1">
                <Button size="sm" className="h-6 text-[10px] flex-1" onClick={handleCreate} disabled={isCreating || !branchName.trim()}>
                  {isCreating ? '생성 중…' : '생성'}
                </Button>
                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setShowForm(false)}>
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded-sm hover:bg-muted text-left text-muted-foreground"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-2.5 w-2.5" />
              <span className="font-mono text-[10px]">새 워크트리</span>
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
