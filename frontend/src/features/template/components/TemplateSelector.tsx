import { FileStack } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTemplates } from "@/features/template/hooks/useTemplates";
import type { TemplateInfo } from "@/types";

interface TemplateSelectorProps {
  onSelect: (template: TemplateInfo | null) => void;
}

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const { data: templates, isLoading } = useTemplates();

  const handleChange = (value: string) => {
    if (value === "__none__") {
      onSelect(null);
      return;
    }
    const selected = templates?.find((t) => t.id === value);
    onSelect(selected ?? null);
  };

  return (
    <Select onValueChange={handleChange} defaultValue="__none__">
      <SelectTrigger className="font-mono text-xs bg-input border-border">
        <div className="flex items-center gap-2">
          <FileStack className="h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue placeholder="템플릿 선택 (선택사항)" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__" className="font-mono text-xs">
          템플릿 없음
        </SelectItem>
        {isLoading ? (
          <SelectItem value="__loading__" disabled className="font-mono text-xs">
            불러오는 중…
          </SelectItem>
        ) : null}
        {templates?.map((tpl) => (
          <SelectItem
            key={tpl.id}
            value={tpl.id}
            className="font-mono text-xs"
          >
            <span>{tpl.name}</span>
            {tpl.description ? (
              <span className="ml-2 text-muted-foreground">
                — {tpl.description}
              </span>
            ) : null}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
