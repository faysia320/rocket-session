import { Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { WorkflowDefinitionInfo } from "@/types/workflow";

interface DefinitionItemProps {
  definition: WorkflowDefinitionInfo;
  selected: boolean;
  onSelect: () => void;
}

function DefinitionItem({ definition, selected, onSelect }: DefinitionItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "w-full flex flex-col gap-0.5 px-3 py-2 transition-colors border-l-2 text-left",
        selected ? "bg-muted/70 border-l-primary" : "hover:bg-muted/30 border-l-transparent",
      )}
      onClick={onSelect}
      aria-label={`워크플로우 정의 ${definition.name} 선택`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Workflow className="h-3 w-3 text-primary shrink-0" />
        <span className="font-mono text-xs text-foreground truncate">
          {definition.name}
        </span>
      </div>
      <div className="flex items-center gap-1.5 pl-[18px]">
        <Badge variant="secondary" className="font-mono text-2xs px-1 py-0 shrink-0">
          {definition.steps.length}단계
        </Badge>
        {definition.is_builtin ? (
          <Badge variant="outline" className="font-mono text-2xs px-1 py-0 shrink-0">
            기본 제공
          </Badge>
        ) : null}
      </div>
    </button>
  );
}

interface WorkflowDefinitionListProps {
  definitions: WorkflowDefinitionInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function WorkflowDefinitionList({
  definitions,
  selectedId,
  onSelect,
}: WorkflowDefinitionListProps) {
  return (
    <div className="flex flex-col h-full border-r border-border w-72 shrink-0">
      <div className="flex items-center px-3 py-2 border-b border-border shrink-0">
        <span className="font-mono text-xs font-semibold text-muted-foreground">정의 목록</span>
      </div>
      <ScrollArea className="flex-1">
        {definitions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
            <Workflow className="h-6 w-6 text-muted-foreground/30 mb-2" />
            <span className="font-mono text-2xs text-muted-foreground">정의를 추가하세요</span>
          </div>
        ) : (
          definitions.map((def) => (
            <DefinitionItem
              key={def.id}
              definition={def}
              selected={def.id === selectedId}
              onSelect={() => onSelect(def.id)}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
