import { useState, memo } from "react";
import { ListTodo, CheckCircle2, Loader2, Circle, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { TodoItem } from "../hooks/claudeSocketReducer";

interface PinnedTodoBarProps {
  todos: TodoItem[];
}

export const PinnedTodoBar = memo(function PinnedTodoBar({ todos }: PinnedTodoBarProps) {
  const [open, setOpen] = useState(true);

  if (todos.length === 0) return null;

  const completedCount = todos.filter((t) => t.status === "completed").length;
  const inProgressCount = todos.filter((t) => t.status === "in_progress").length;
  const totalCount = todos.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border-b border-border/80 border-l-[3px] border-l-primary/40 bg-primary/5">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 w-full px-4 py-1.5 text-xs hover:bg-muted/30 transition-colors"
            aria-label={open ? "Todo bar collapse" : "Todo bar expand"}
          >
            <ListTodo className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="font-mono text-xs font-semibold text-foreground">Todo</span>
            <span className="font-mono text-2xs text-muted-foreground">
              {completedCount}/{totalCount}
            </span>
            {/* status dots */}
            <span className="flex items-center gap-0.5 ml-1">
              {completedCount > 0 ? (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" title={`${completedCount} completed`} />
              ) : null}
              {inProgressCount > 0 ? (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-info animate-pulse" title={`${inProgressCount} in progress`} />
              ) : null}
              {totalCount - completedCount - inProgressCount > 0 ? (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/40" title={`${totalCount - completedCount - inProgressCount} pending`} />
              ) : null}
            </span>
            <span className="ml-auto">
              {open ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground/70" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground/70" />
              )}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-2 space-y-0.5">
            {todos.map((todo, i) => (
              <div
                key={i}
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
                  {todo.status === "in_progress" ? (todo.activeForm ?? todo.content) : todo.content}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});

function TodoStatusIcon({ status }: { status: TodoItem["status"] }) {
  if (status === "completed") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" aria-label="completed" />;
  }
  if (status === "in_progress") {
    return (
      <Loader2
        className="h-3.5 w-3.5 text-info shrink-0 mt-0.5 animate-spin"
        aria-label="in progress"
      />
    );
  }
  return (
    <Circle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" aria-label="pending" />
  );
}
