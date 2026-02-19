import { memo } from "react";
import { ListTodo, CheckCircle2, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolUseMsg } from "@/types";

interface TodoItem {
  content: string;
  status: "completed" | "in_progress" | "pending";
  activeForm?: string;
}

interface TodoWriteMessageProps {
  message: ToolUseMsg;
}

export const TodoWriteMessage = memo(function TodoWriteMessage({
  message,
}: TodoWriteMessageProps) {
  const todos = Array.isArray(message.input?.todos)
    ? (message.input.todos as TodoItem[])
    : [];

  const completedCount = todos.filter((t) => t.status === "completed").length;
  const totalCount = todos.length;

  return (
    <div className="animate-[slideInLeft_0.2s_ease]">
      <div className="px-3 py-2.5 bg-secondary border border-border rounded-sm border-l-[3px] border-l-primary/60">
        <div className="flex items-center gap-2 mb-2">
          <ListTodo className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-mono text-xs font-semibold text-foreground">
            Todo
          </span>
          {totalCount > 0 ? (
            <span className="font-mono text-2xs text-muted-foreground ml-auto">
              {completedCount}/{totalCount}
            </span>
          ) : null}
        </div>

        {totalCount > 0 ? (
          <div className="space-y-1">
            {todos.map((todo, i) => (
              <TodoItemRow key={i} todo={todo} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
});

function TodoItemRow({ todo }: { todo: TodoItem }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 px-2 py-1 rounded-sm",
        todo.status === "completed" && "opacity-60",
        todo.status === "in_progress" && "bg-info/5",
      )}
    >
      <TodoStatusIcon status={todo.status} />
      <span
        className={cn(
          "font-mono text-xs flex-1 leading-relaxed",
          todo.status === "completed"
            ? "text-muted-foreground line-through"
            : todo.status === "in_progress"
              ? "text-foreground font-medium"
              : "text-muted-foreground",
        )}
      >
        {todo.status === "in_progress"
          ? (todo.activeForm ?? todo.content)
          : todo.content}
      </span>
    </div>
  );
}

function TodoStatusIcon({ status }: { status: TodoItem["status"] }) {
  if (status === "completed") {
    return (
      <CheckCircle2
        className="h-3.5 w-3.5 text-success shrink-0 mt-0.5"
        aria-label="완료"
      />
    );
  }
  if (status === "in_progress") {
    return (
      <Loader2
        className="h-3.5 w-3.5 text-info shrink-0 mt-0.5 animate-spin"
        aria-label="진행 중"
      />
    );
  }
  return (
    <Circle
      className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5"
      aria-label="대기"
    />
  );
}
