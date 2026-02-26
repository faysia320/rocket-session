import { Workflow } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkflowDefinitions } from "@/features/workflow/hooks/useWorkflowDefinitions";

interface WorkflowDefinitionSelectorProps {
  value: string | null;
  onSelect: (definitionId: string | null) => void;
}

export function WorkflowDefinitionSelector({
  value,
  onSelect,
}: WorkflowDefinitionSelectorProps) {
  const { data: definitions, isLoading } = useWorkflowDefinitions();

  const handleChange = (val: string) => {
    if (val === "__none__") {
      onSelect(null);
      return;
    }
    onSelect(val);
  };

  return (
    <Select onValueChange={handleChange} value={value ?? "__none__"}>
      <SelectTrigger className="font-mono text-xs bg-input border-border">
        <div className="flex items-center gap-2">
          <Workflow className="h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue placeholder="기본 워크플로우" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__" className="font-mono text-xs">
          기본 워크플로우
        </SelectItem>
        {isLoading ? (
          <SelectItem value="__loading__" disabled className="font-mono text-xs">
            불러오는 중...
          </SelectItem>
        ) : null}
        {definitions?.map((def) => (
          <SelectItem key={def.id} value={def.id} className="font-mono text-xs">
            <span>{def.name}</span>
            {def.description ? (
              <span className="ml-2 text-muted-foreground">
                — {def.description}
              </span>
            ) : null}
            <span className="ml-2 text-muted-foreground/60">
              ({def.steps.length}단계)
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
