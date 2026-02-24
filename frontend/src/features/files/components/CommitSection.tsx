import { useState, useCallback } from "react";
import { GitCommit, X, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { workflowApi } from "@/lib/api/workflow.api";
import { toast } from "sonner";
import type { WorkflowCommitSuggestion } from "@/types/workflow";

interface CommitSectionProps {
  sessionId: string;
  suggestion: WorkflowCommitSuggestion;
  onCommitSuccess: (hash: string) => void;
  onDismiss: () => void;
}

export function CommitSection({
  sessionId,
  suggestion,
  onCommitSuccess,
  onDismiss,
}: CommitSectionProps) {
  const [title, setTitle] = useState(suggestion.title);
  const [body, setBody] = useState(suggestion.body);

  const commitMutation = useMutation({
    mutationFn: (message: string) => workflowApi.commit(sessionId, { message }),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`커밋 완료: ${data.commit_hash}`);
        onCommitSuccess(data.commit_hash);
      } else {
        toast.error(data.error ?? "커밋 실패");
      }
    },
    onError: (err) => {
      toast.error(`커밋 실패: ${err instanceof Error ? err.message : String(err)}`);
    },
  });

  const handleCommit = useCallback(() => {
    const message = body.trim() ? `${title}\n\n${body}` : title;
    commitMutation.mutate(message);
  }, [title, body, commitMutation]);

  return (
    <div className="border-b border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <GitCommit className="h-4 w-4 text-success shrink-0" />
        <span className="font-mono text-xs font-semibold text-foreground flex-1">
          Commit
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onDismiss}
          aria-label="커밋 닫기"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="커밋 제목"
        className="font-mono text-xs h-8"
      />

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="커밋 본문 (선택)"
        rows={3}
        className="font-mono text-xs resize-none"
      />

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          닫기
        </Button>
        <Button
          size="sm"
          onClick={handleCommit}
          disabled={!title.trim() || commitMutation.isPending}
        >
          {commitMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <GitCommit className="h-3 w-3 mr-1" />
          )}
          Commit
        </Button>
      </div>
    </div>
  );
}
