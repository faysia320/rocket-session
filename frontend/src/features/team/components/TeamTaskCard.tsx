import { memo, useState } from "react";
import { GripVertical, Trash2, User, AlertCircle, CheckCircle2, Clock, ArrowRight, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TeamTaskInfo, TaskStatus, TeamMemberInfo } from "@/types";

interface TeamTaskCardProps {
  task: TeamTaskInfo;
  members: TeamMemberInfo[];
  onStatusChange: (taskId: number, status: TaskStatus) => void;
  onAssign: (taskId: number, sessionId: string) => void;
  onComplete: (taskId: number) => void;
  onDelete: (taskId: number) => void;
  onEdit: (task: TeamTaskInfo) => void;
  onDelegate?: (task: TeamTaskInfo) => void;
  dragHandleProps?: Record<string, unknown>;
}

const priorityConfig = {
  high: { label: "High", class: "bg-destructive/15 text-destructive border-destructive/20" },
  medium: { label: "Mid", class: "bg-warning/15 text-warning border-warning/20" },
  low: { label: "Low", class: "bg-muted text-muted-foreground border-border" },
} as const;

const statusIcons: Record<TaskStatus, typeof Clock> = {
  pending: Clock,
  in_progress: ArrowRight,
  completed: CheckCircle2,
  failed: AlertCircle,
  cancelled: AlertCircle,
};

export const TeamTaskCard = memo(function TeamTaskCard({
  task,
  members,
  onStatusChange,
  onAssign,
  onComplete,
  onDelete,
  onEdit,
  onDelegate,
  dragHandleProps,
}: TeamTaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const priority = priorityConfig[task.priority];
  const StatusIcon = statusIcons[task.status];
  const assignedMember = task.assigned_session_id
    ? members.find((m) => m.session_id === task.assigned_session_id)
    : null;

  return (
    <div
      className={cn(
        "group bg-card border border-border rounded-md p-3 hover:border-primary/30 transition-colors cursor-pointer",
        task.status === "completed" && "opacity-70",
        task.status === "failed" && "border-destructive/30",
      )}
      onClick={() => onEdit(task)}
    >
      {/* 헤더: 드래그 핸들 + 우선순위 + 메뉴 */}
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          className="mt-0.5 p-0.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="드래그하여 순서 변경"
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Badge
              variant="outline"
              className={cn("font-mono text-[10px] px-1.5 py-0", priority.class)}
            >
              {priority.label}
            </Badge>
            <StatusIcon className="h-3 w-3 text-muted-foreground/60" />
          </div>
          <p className="font-mono text-xs font-medium leading-snug line-clamp-2">
            {task.title}
          </p>
          {task.description ? (
            <p className="font-mono text-2xs text-muted-foreground mt-1 line-clamp-2">
              {task.description}
            </p>
          ) : null}
        </div>

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
              aria-label="태스크 메뉴"
            >
              <span className="text-xs">...</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="font-mono text-xs">
            {task.status === "pending" && onDelegate ? (
              <DropdownMenuItem onClick={() => onDelegate(task)}>
                <Send className="h-3 w-3 mr-2" />
                세션에 위임
              </DropdownMenuItem>
            ) : null}
            {task.status === "pending" ? (
              <DropdownMenuItem onClick={() => onStatusChange(task.id, "in_progress")}>
                <ArrowRight className="h-3 w-3 mr-2" />
                진행 시작
              </DropdownMenuItem>
            ) : null}
            {task.status === "in_progress" ? (
              <DropdownMenuItem onClick={() => onComplete(task.id)}>
                <CheckCircle2 className="h-3 w-3 mr-2" />
                완료 처리
              </DropdownMenuItem>
            ) : null}
            {task.status === "completed" || task.status === "failed" ? (
              <DropdownMenuItem onClick={() => onStatusChange(task.id, "pending")}>
                <Clock className="h-3 w-3 mr-2" />
                대기로 되돌리기
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            {/* 멤버 할당 */}
            {members.length > 0 ? (
              <>
                {members.map((m) => (
                  <DropdownMenuItem
                    key={m.session_id}
                    onClick={() => onAssign(task.id, m.session_id)}
                  >
                    <User className="h-3 w-3 mr-2" />
                    {m.nickname || m.session_name || m.session_id.slice(0, 8)}에 할당
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="h-3 w-3 mr-2" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 푸터: 담당자 */}
      {assignedMember ? (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
          <User className="h-3 w-3 text-muted-foreground/60" />
          <span className="font-mono text-2xs text-muted-foreground">
            {assignedMember.nickname || assignedMember.session_name || assignedMember.session_id.slice(0, 8)}
          </span>
        </div>
      ) : null}

      {/* 결과 요약 (완료된 태스크) */}
      {task.result_summary ? (
        <div className="mt-2 pt-2 border-t border-border/50">
          <p className="font-mono text-2xs text-success/80 line-clamp-2">
            {task.result_summary}
          </p>
        </div>
      ) : null}
    </div>
  );
});
