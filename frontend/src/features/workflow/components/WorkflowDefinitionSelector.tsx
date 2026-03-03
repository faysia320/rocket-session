import { useEffect, useMemo } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
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

  return (
    <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
      {isLoading ? (
        <p className="font-mono text-xs text-muted-foreground px-2 py-1.5">
          불러오는 중...
        </p>
      ) : null}
      {sortedDefinitions.map((def) => {
        const isSelected = def.id === value;
        return (
          <button
            key={def.id}
            type="button"
            onClick={() => onSelect(def.id)}
            className={cn(
              "w-full text-left rounded-sm px-2 py-1.5 text-xs font-mono transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              isSelected && "bg-accent text-accent-foreground",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{def.name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="opacity-50">({def.steps.length}단계)</span>
                {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
              </div>
            </div>
            {def.description ? (
              <p className="text-[11px] opacity-60 truncate mt-0.5">
                {def.description}
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
