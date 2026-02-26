import { useEffect, useMemo } from "react";
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

export function WorkflowDefinitionSelector({ value, onSelect }: WorkflowDefinitionSelectorProps) {
  const { data: definitions, isLoading } = useWorkflowDefinitions();

  // definitions 로드 후, value가 null이면 default 자동 선택
  useEffect(() => {
    if (!value && definitions && definitions.length > 0) {
      const defaultDef = definitions.find((d) => d.is_default);
      if (defaultDef) {
        onSelect(defaultDef.id);
      }
    }
  }, [value, definitions, onSelect]);

  const sortedDefinitions = useMemo(() => {
    if (!definitions) return [];
    return [...definitions].sort((a, b) => Number(b.is_default) - Number(a.is_default));
  }, [definitions]);

  const handleChange = (val: string) => {
    onSelect(val);
  };

  return (
    <Select onValueChange={handleChange} value={value ?? ""}>
      <SelectTrigger className="font-mono text-xs bg-input border-border">
        <div className="flex items-center gap-2">
          <Workflow className="h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue placeholder="워크플로우 선택…" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {isLoading ? (
          <SelectItem value="__loading__" disabled className="font-mono text-xs">
            불러오는 중...
          </SelectItem>
        ) : null}
        {sortedDefinitions.map((def) => (
          <SelectItem key={def.id} value={def.id} className="font-mono text-xs">
            <span>{def.name}</span>
            {def.description ? (
              <span className="ml-2 text-muted-foreground">— {def.description}</span>
            ) : null}
            <span className="ml-2 text-muted-foreground/60">({def.steps.length}단계)</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
