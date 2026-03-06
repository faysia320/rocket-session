import { memo, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ValidationCommand } from "@/types/workspace";

interface ValidationCommandEditorProps {
  commands: ValidationCommand[];
  onChange: (commands: ValidationCommand[]) => void;
}

const DEFAULT_COMMAND: ValidationCommand = {
  name: "",
  command: "",
  run_on: ["phase_entry"],
  timeout_seconds: 60,
};

export const ValidationCommandEditor = memo(function ValidationCommandEditor({
  commands,
  onChange,
}: ValidationCommandEditorProps) {
  "use memo";

  const handleAdd = useCallback(() => {
    onChange([...commands, { ...DEFAULT_COMMAND }]);
  }, [commands, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onChange(commands.filter((_, i) => i !== index));
    },
    [commands, onChange],
  );

  const handleUpdate = useCallback(
    (index: number, field: keyof ValidationCommand, value: string | number) => {
      onChange(
        commands.map((cmd, i) =>
          i === index ? { ...cmd, [field]: value } : cmd,
        ),
      );
    },
    [commands, onChange],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">검증 명령</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-2xs"
          onClick={handleAdd}
        >
          <Plus className="h-3 w-3 mr-1" />
          추가
        </Button>
      </div>

      {commands.length === 0 ? (
        <p className="text-2xs text-muted-foreground py-4 text-center">
          검증 명령이 없습니다. 추가 버튼을 눌러 lint, test, build 등의 명령을 설정하세요.
        </p>
      ) : null}

      <div className="space-y-3">
        {commands.map((cmd, index) => (
          <div
            key={index}
            className="rounded-md border border-border bg-muted/30 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <Input
                value={cmd.name}
                onChange={(e) => handleUpdate(index, "name", e.target.value)}
                placeholder="이름 (예: TypeScript 타입 검사)"
                className="h-7 text-xs font-mono"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleRemove(index)}
                aria-label="명령 삭제"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input
              value={cmd.command}
              onChange={(e) => handleUpdate(index, "command", e.target.value)}
              placeholder="명령어 (예: cd frontend && npx tsc --noEmit)"
              className="h-7 text-xs font-mono"
            />
            <div className="flex items-center gap-2">
              <Label className="text-2xs text-muted-foreground whitespace-nowrap">
                타임아웃
              </Label>
              <Input
                type="number"
                value={cmd.timeout_seconds}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 5 && v <= 600) {
                    handleUpdate(index, "timeout_seconds", v);
                  }
                }}
                min={5}
                max={600}
                className="h-7 text-xs font-mono w-20"
              />
              <span className="text-2xs text-muted-foreground">초 (5–600)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
