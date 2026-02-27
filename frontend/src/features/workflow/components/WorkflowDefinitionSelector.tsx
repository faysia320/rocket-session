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
    return [...definitions].sort((a, b) => {
      if (a.is_builtin !== b.is_builtin) return Number(b.is_builtin) - Number(a.is_builtin);
      if (a.is_builtin && b.is_builtin) return a.sort_order - b.sort_order;
      if (a.is_default !== b.is_default) return Number(b.is_default) - Number(a.is_default);
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [definitions]);

  const handleChange = (val: string) => {
    onSelect(val);
  };

  return (
    <Select onValueChange={handleChange} value={value ?? ""}>
      <SelectTrigger className="font-mono text-xs bg-input border-border">
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <Workflow className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
            <span className="truncate">
              <span>{def.name}</span>
              {def.description ? (
                <span className="ml-2 opacity-70">— {def.description}</span>
              ) : null}
              <span className="ml-2 opacity-50">({def.steps.length}단계)</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
