import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkspaceSelector } from "@/features/workspace/components/WorkspaceSelector";
import type {
  TeamTaskInfo,
  CreateTaskRequest,
  UpdateTaskRequest,
  TaskPriority,
  TeamMemberInfo,
} from "@/types";

interface TeamTaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 편집 모드일 때 기존 태스크 전달 */
  editTask?: TeamTaskInfo | null;
  members: TeamMemberInfo[];
  onCreate: (data: CreateTaskRequest) => Promise<unknown>;
  onUpdate?: (taskId: number, data: UpdateTaskRequest) => Promise<unknown>;
  isCreating: boolean;
}

export function TeamTaskCreateDialog({
  open,
  onOpenChange,
  editTask,
  members,
  onCreate,
  onUpdate,
  isCreating,
}: TeamTaskCreateDialogProps) {
  const isEdit = !!editTask;
  const [title, setTitle] = useState(editTask?.title ?? "");
  const [description, setDescription] = useState(editTask?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(editTask?.priority ?? "medium");
  const [workspaceId, setWorkspaceId] = useState(editTask?.workspace_id ?? "");
  const [assignedMemberId, setAssignedMemberId] = useState(
    editTask?.assigned_member_id != null ? String(editTask.assigned_member_id) : "",
  );

  // 다이얼로그가 열릴 때 편집 데이터 반영
  const handleOpenChange = (next: boolean) => {
    if (next && editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description ?? "");
      setPriority(editTask.priority);
      setWorkspaceId(editTask.workspace_id ?? "");
      setAssignedMemberId(
        editTask.assigned_member_id != null ? String(editTask.assigned_member_id) : "",
      );
    }
    if (!next) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setWorkspaceId("");
      setAssignedMemberId("");
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (isEdit && onUpdate && editTask) {
      await onUpdate(editTask.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        workspace_id: workspaceId || undefined,
        assigned_member_id: assignedMemberId ? Number(assignedMemberId) : undefined,
      });
    } else {
      if (!workspaceId) return;
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        workspace_id: workspaceId,
        assigned_member_id: assignedMemberId ? Number(assignedMemberId) : undefined,
      });
    }
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            {isEdit ? "태스크 수정" : "새 태스크 생성"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* 제목 */}
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-muted-foreground">제목 *</label>
            <Input
              className="font-mono text-sm"
              placeholder="태스크 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* 설명 */}
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-muted-foreground">설명</label>
            <Textarea
              className="font-mono text-sm min-h-[80px] resize-none"
              placeholder="태스크 상세 설명 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* 워크스페이스 */}
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-muted-foreground">
              워크스페이스 {isEdit ? "" : "*"}
            </label>
            <WorkspaceSelector
              value={workspaceId || null}
              onChange={(v) => setWorkspaceId(v ?? "")}
            />
          </div>

          {/* 우선순위 */}
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-muted-foreground">우선순위</label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger className="font-mono text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high" className="font-mono text-xs">
                  High
                </SelectItem>
                <SelectItem value="medium" className="font-mono text-xs">
                  Medium
                </SelectItem>
                <SelectItem value="low" className="font-mono text-xs">
                  Low
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 담당자 */}
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-muted-foreground">담당자</label>
            <Select
              value={assignedMemberId || "_none"}
              onValueChange={(v) => setAssignedMemberId(v === "_none" ? "" : v)}
            >
              <SelectTrigger className="font-mono text-sm">
                <SelectValue placeholder="미지정" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none" className="font-mono text-xs">
                  미지정
                </SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)} className="font-mono text-xs">
                    {m.nickname}
                    {m.description ? ` (${m.description})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 제출 */}
          <Button
            className="w-full font-mono text-sm"
            onClick={handleSubmit}
            disabled={!title.trim() || (!isEdit && !workspaceId) || isCreating}
          >
            {isCreating ? (isEdit ? "수정 중…" : "생성 중…") : isEdit ? "수정" : "태스크 생성"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
