import { useState, useCallback, useEffect } from "react";
import { GitCommitHorizontal, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useStageAndCommit } from "../hooks/useGitActions";
import { useCreateSession } from "@/features/session/hooks/useSessions";
import { useWorkflowDefinitions } from "@/features/workflow/hooks/useWorkflowDefinitions";
import { useSessionStore } from "@/store";
import { cn } from "@/lib/utils";

interface CommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repoPath: string;
  workspacePath: string;
  workspaceId: string;
}

type CommitMode = "manual" | "ai";

export function CommitDialog({ open, onOpenChange, repoPath, workspacePath, workspaceId }: CommitDialogProps) {
  const [mode, setMode] = useState<CommitMode>("ai");
  const [message, setMessage] = useState("");
  const commitMutation = useStageAndCommit(repoPath);
  const { createSession } = useCreateSession();
  const setPendingPrompt = useSessionStore((s) => s.setPendingPrompt);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [commitMethod, setCommitMethod] = useState<string>("__skill__");
  const { data: workflowDefinitions } = useWorkflowDefinitions();

  useEffect(() => {
    if (workflowDefinitions) {
      const wf3 = workflowDefinitions.find((d) => d.name === "Workflow 3");
      if (wf3) setCommitMethod(wf3.id);
    }
  }, [workflowDefinitions]);

  const handleManualCommit = useCallback(() => {
    if (!message.trim()) return;
    commitMutation.mutate(message.trim(), {
      onSuccess: () => {
        setMessage("");
        onOpenChange(false);
      },
    });
  }, [message, commitMutation, onOpenChange]);

  const handleAiCommit = useCallback(async () => {
    if (isCreatingSession) return;
    setIsCreatingSession(true);
    try {
      if (commitMethod === "__skill__") {
        const session = await createSession(workspacePath, { workspace_id: workspaceId });
        setPendingPrompt("/git-commit", session.id);
      } else {
        await createSession(workspacePath, {
          workspace_id: workspaceId,
          workflow_definition_id: commitMethod,
        });
      }
      onOpenChange(false);
    } catch {
      setIsCreatingSession(false);
    }
  }, [createSession, workspacePath, workspaceId, setPendingPrompt, onOpenChange, isCreatingSession, commitMethod]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleManualCommit();
      }
    },
    [handleManualCommit],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="font-mono text-sm font-semibold">Commit</DialogTitle>
        </DialogHeader>

        {/* 모드 선택 */}
        <div className="flex gap-1 p-0.5 bg-muted rounded-md">
          <button
            type="button"
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded font-mono text-xs transition-colors",
              mode === "ai"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setMode("ai")}
          >
            <Sparkles className="h-3 w-3" />
            AI 커밋
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded font-mono text-xs transition-colors",
              mode === "manual"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setMode("manual")}
          >
            <GitCommitHorizontal className="h-3 w-3" />
            수동 커밋
          </button>
        </div>

        {/* 커밋 모드 콘텐츠 */}
        {mode === "ai" ? (
          <div className="space-y-3">
            <p className="font-mono text-xs text-muted-foreground">
              {commitMethod === "__skill__" ? (
                <>새 세션을 열고 <code className="bg-muted px-1 py-0.5 rounded">/git-commit</code> 스킬을 실행합니다.</>
              ) : (
                <>새 세션을 열고 선택한 워크플로우로 커밋을 수행합니다.</>
              )}
            </p>
            <Select value={commitMethod} onValueChange={setCommitMethod}>
              <SelectTrigger className="font-mono text-xs h-8 bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__skill__" className="font-mono text-xs">
                  Skill: /git-commit
                </SelectItem>
                {workflowDefinitions && workflowDefinitions.length > 0 && (
                  <>
                    <SelectSeparator />
                    {workflowDefinitions.map((def) => (
                      <SelectItem key={def.id} value={def.id} className="font-mono text-xs">
                        {def.name}
                        {def.description && (
                          <span className="ml-2 text-muted-foreground">— {def.description}</span>
                        )}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={() => onOpenChange(false)}
              >
                취소
              </Button>
              <Button
                size="sm"
                className="font-mono text-xs"
                onClick={handleAiCommit}
                disabled={isCreatingSession || !workflowDefinitions}
              >
                {isCreatingSession ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1" />
                )}
                세션 열기
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea
              placeholder="커밋 메시지를 입력하세요..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="font-mono text-xs min-h-[80px] resize-none"
              autoFocus
            />
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xs text-muted-foreground">
                Ctrl+Enter로 커밋
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs"
                  onClick={() => onOpenChange(false)}
                >
                  취소
                </Button>
                <Button
                  size="sm"
                  className="font-mono text-xs"
                  onClick={handleManualCommit}
                  disabled={!message.trim() || commitMutation.isPending}
                >
                  {commitMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <GitCommitHorizontal className="h-3 w-3 mr-1" />
                  )}
                  Stage All & Commit
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
