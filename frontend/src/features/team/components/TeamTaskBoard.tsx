import { useState, useCallback } from "react";
import { Plus, ListTodo, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { teamsApi } from "@/lib/api/teams.api";
import { toast } from "sonner";
import { useTeamTasks } from "../hooks/useTeamTasks";
import { TeamTaskCard } from "./TeamTaskCard";
import { TeamTaskCreateDialog } from "./TeamTaskCreateDialog";
import { TeamTaskDelegateDialog } from "./TeamTaskDelegateDialog";
import type { TeamTaskInfo, TaskStatus, TeamMemberInfo } from "@/types";

interface TeamTaskBoardProps {
  teamId: string;
  members: TeamMemberInfo[];
}

const columns = [
  { key: "pending" as const, label: "대기", icon: ListTodo, color: "text-warning" },
  { key: "in_progress" as const, label: "진행 중", icon: ArrowRight, color: "text-info" },
  { key: "completed" as const, label: "완료", icon: CheckCircle2, color: "text-success" },
] as const;

export function TeamTaskBoard({ teamId, members }: TeamTaskBoardProps) {
  const {
    tasksByStatus,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
    claimTask,
    completeTask,
    isCreating,
    invalidateTasks,
  } = useTeamTasks(teamId);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<TeamTaskInfo | null>(null);
  const [delegateTask, setDelegateTask] = useState<TeamTaskInfo | null>(null);

  const handleStatusChange = useCallback(
    async (taskId: number, status: TaskStatus) => {
      await updateTask({ taskId, data: { status } });
    },
    [updateTask],
  );

  const handleAssign = useCallback(
    async (taskId: number, sessionId: string) => {
      await claimTask({ taskId, sessionId });
    },
    [claimTask],
  );

  const handleComplete = useCallback(
    async (taskId: number) => {
      await completeTask({ taskId });
    },
    [completeTask],
  );

  const handleEdit = useCallback((task: TeamTaskInfo) => {
    setEditTask(task);
  }, []);

  const handleDelegate = useCallback(
    async (taskId: number, sessionId: string, prompt?: string) => {
      try {
        await teamsApi.delegateTask(teamId, taskId, sessionId, prompt);
        toast.success("태스크가 위임되었습니다");
        invalidateTasks();
      } catch (err) {
        toast.error(`위임 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      }
    },
    [teamId, invalidateTasks],
  );

  const handleOpenDelegate = useCallback((task: TeamTaskInfo) => {
    setDelegateTask(task);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="font-mono text-sm text-muted-foreground animate-pulse">
          태스크 로딩 중…
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground tracking-widest">
          태스크 보드
        </span>
        <Button
          variant="outline"
          size="sm"
          className="font-mono text-2xs gap-1"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-3 w-3" />
          새 태스크
        </Button>
      </div>

      {/* 칸반 보드 3컬럼 */}
      <div className="grid grid-cols-3 gap-3">
        {columns.map((col) => {
          const tasks = tasksByStatus[col.key];
          const Icon = col.icon;
          return (
            <div
              key={col.key}
              className="bg-muted/20 border border-border rounded-lg overflow-hidden"
            >
              {/* 컬럼 헤더 */}
              <div className="px-3 py-2 border-b border-border/50 flex items-center gap-2">
                <Icon className={cn("h-3.5 w-3.5", col.color)} />
                <span className="font-mono text-xs font-medium">{col.label}</span>
                <span className="font-mono text-2xs text-muted-foreground ml-auto">
                  {tasks.length}
                </span>
              </div>

              {/* 카드 목록 */}
              <ScrollArea className="max-h-[calc(100vh-380px)]">
                <div className="p-2 space-y-2">
                  {tasks.length === 0 ? (
                    <div className="py-8 text-center">
                      <span className="font-mono text-2xs text-muted-foreground/50">
                        {col.key === "pending"
                          ? "대기 중인 태스크 없음"
                          : col.key === "in_progress"
                            ? "진행 중인 태스크 없음"
                            : "완료된 태스크 없음"}
                      </span>
                    </div>
                  ) : (
                    tasks.map((task) => (
                      <TeamTaskCard
                        key={task.id}
                        task={task}
                        members={members}
                        onStatusChange={handleStatusChange}
                        onAssign={handleAssign}
                        onComplete={handleComplete}
                        onDelete={deleteTask}
                        onEdit={handleEdit}
                        onDelegate={handleOpenDelegate}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>

      {/* 생성 다이얼로그 */}
      <TeamTaskCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        members={members}
        onCreate={createTask}
        isCreating={isCreating}
      />

      {/* 편집 다이얼로그 */}
      <TeamTaskCreateDialog
        open={!!editTask}
        onOpenChange={(open) => {
          if (!open) setEditTask(null);
        }}
        editTask={editTask}
        members={members}
        onCreate={createTask}
        onUpdate={async (taskId, data) => {
          await updateTask({ taskId, data });
        }}
        isCreating={false}
      />

      {/* 위임 다이얼로그 */}
      <TeamTaskDelegateDialog
        open={!!delegateTask}
        onOpenChange={(open) => {
          if (!open) setDelegateTask(null);
        }}
        task={delegateTask}
        members={members}
        onDelegate={handleDelegate}
      />
    </div>
  );
}
