import { Blocks, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { WorkflowNodeInfo } from "@/types/workflow";

interface NodeItemProps {
  node: WorkflowNodeInfo;
  selected: boolean;
  onSelect: () => void;
}

function NodeItem({ node, selected, onSelect }: NodeItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "w-full flex flex-col gap-0.5 px-3 py-2 transition-colors border-l-2 text-left",
        selected ? "bg-muted/70 border-l-primary" : "hover:bg-muted/30 border-l-transparent",
      )}
      onClick={onSelect}
      aria-label={`워크플로우 노드 ${node.name} 선택`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Blocks className="h-3 w-3 text-primary shrink-0" />
        <span className="font-mono text-xs text-foreground truncate">
          {node.label}
        </span>
      </div>
      <div className="flex items-center gap-1.5 pl-[18px]">
        <Badge variant="secondary" className="font-mono text-2xs px-1 py-0 shrink-0">
          {node.name}
        </Badge>
        <Badge variant="outline" className="font-mono text-2xs px-1 py-0 shrink-0">
          {node.constraints}
        </Badge>
        {node.is_builtin ? (
          <Badge variant="outline" className="font-mono text-2xs px-1 py-0 shrink-0">
            기본 제공
          </Badge>
        ) : null}
      </div>
    </button>
  );
}

interface WorkflowNodeListProps {
  nodes: WorkflowNodeInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function WorkflowNodeList({
  nodes,
  selectedId,
  onSelect,
  onAdd,
}: WorkflowNodeListProps) {
  return (
    <div className="flex flex-col h-full border-r border-border w-72 shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="font-mono text-xs font-semibold text-muted-foreground">노드 목록</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onAdd}
              aria-label="새 노드 만들기"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="font-mono text-xs">새 노드 만들기</TooltipContent>
        </Tooltip>
      </div>
      <ScrollArea className="flex-1">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
            <Blocks className="h-6 w-6 text-muted-foreground/30 mb-2" />
            <span className="font-mono text-2xs text-muted-foreground">노드를 추가하세요</span>
          </div>
        ) : (
          nodes.map((node) => (
            <NodeItem
              key={node.id}
              node={node}
              selected={node.id === selectedId}
              onSelect={() => onSelect(node.id)}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
