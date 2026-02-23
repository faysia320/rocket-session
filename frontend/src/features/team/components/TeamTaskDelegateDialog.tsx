import { useState } from "react";
import { Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { TeamMemberInfo, TeamTaskInfo } from "@/types";

interface TeamTaskDelegateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TeamTaskInfo | null;
  members: TeamMemberInfo[];
  onDelegate: (taskId: number, sessionId: string, prompt?: string) => void;
}

export function TeamTaskDelegateDialog({
  open,
  onOpenChange,
  task,
  members,
  onDelegate,
}: TeamTaskDelegateDialogProps) {
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [prompt, setPrompt] = useState("");

  const handleDelegate = () => {
    if (!task || !selectedSessionId) return;
    onDelegate(task.id, selectedSessionId, prompt.trim() || undefined);
    setSelectedSessionId("");
    setPrompt("");
    onOpenChange(false);
  };

  // idle 상태의 멤버만 표시 (running 중인 세션은 위임 불가)
  const availableMembers = members.filter(
    (m) => m.session_status === "idle" || m.session_status === null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            태스크 위임
          </DialogTitle>
        </DialogHeader>
        {task ? (
          <div className="space-y-4 pt-2">
            {/* 태스크 정보 */}
            <div className="bg-muted/30 border border-border rounded px-3 py-2">
              <div className="font-mono text-xs font-medium">{task.title}</div>
              {task.description ? (
                <div className="font-mono text-2xs text-muted-foreground mt-1 line-clamp-2">
                  {task.description}
                </div>
              ) : null}
            </div>

            {/* 대상 세션 선택 */}
            <div className="space-y-1.5">
              <label className="font-mono text-xs text-muted-foreground">
                위임 대상 세션
              </label>
              {availableMembers.length === 0 ? (
                <div className="font-mono text-xs text-muted-foreground/70 py-2">
                  위임 가능한 세션이 없습니다 (idle 상태만 가능)
                </div>
              ) : (
                <ScrollArea className="max-h-36">
                  <div className="space-y-1">
                    {availableMembers.map((m) => (
                      <button
                        key={m.session_id}
                        type="button"
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-sm font-mono text-xs border border-transparent hover:bg-muted/50 transition-colors",
                          selectedSessionId === m.session_id &&
                            "bg-muted border-primary/30",
                        )}
                        onClick={() => setSelectedSessionId(m.session_id)}
                      >
                        <div className="font-medium">
                          {m.nickname || m.session_name || m.session_id.slice(0, 8)}
                        </div>
                        <div className="text-2xs text-muted-foreground">
                          {m.role === "lead" ? "리드" : "멤버"} · {m.session_status || "unknown"}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* 프롬프트 (선택) */}
            <div className="space-y-1.5">
              <label className="font-mono text-xs text-muted-foreground">
                프롬프트 (선택, 비워두면 태스크 설명 사용)
              </label>
              <Textarea
                className="font-mono text-sm min-h-[60px] resize-none"
                placeholder="세션에 전달할 프롬프트…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            {/* 제출 */}
            <Button
              className="w-full font-mono text-sm gap-2"
              onClick={handleDelegate}
              disabled={!selectedSessionId}
            >
              <Send className="h-3.5 w-3.5" />
              위임 실행
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
