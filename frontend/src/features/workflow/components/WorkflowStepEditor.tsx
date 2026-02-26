import { useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  GripVertical,
  Search,
  FileText,
  Code,
  Wrench,
  TestTube,
  Eye,
  Palette,
  BookOpen,
  Hammer,
  CheckCircle,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { WorkflowStepConfig } from "@/types/workflow";

const ICON_OPTIONS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: "Search", label: "Search", Icon: Search },
  { value: "FileText", label: "FileText", Icon: FileText },
  { value: "Code", label: "Code", Icon: Code },
  { value: "Wrench", label: "Wrench", Icon: Wrench },
  { value: "TestTube", label: "TestTube", Icon: TestTube },
  { value: "Eye", label: "Eye", Icon: Eye },
  { value: "Palette", label: "Palette", Icon: Palette },
  { value: "BookOpen", label: "BookOpen", Icon: BookOpen },
  { value: "Hammer", label: "Hammer", Icon: Hammer },
  { value: "CheckCircle", label: "CheckCircle", Icon: CheckCircle },
];

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_OPTIONS.map(({ value, Icon }) => [value, Icon]),
);

const CONSTRAINT_PRESETS = [
  { value: "readonly", label: "읽기 전용 (readonly)" },
  { value: "full", label: "전체 (full)" },
  { value: "__custom__", label: "직접 입력" },
];

const NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

function createDefaultStep(orderIndex: number): WorkflowStepConfig {
  return {
    name: "",
    label: "",
    icon: "FileText",
    prompt_template: "",
    constraints: "full",
    auto_advance: false,
    review_required: false,
    order_index: orderIndex,
  };
}

interface WorkflowStepEditorProps {
  steps: WorkflowStepConfig[];
  onChange: (steps: WorkflowStepConfig[]) => void;
}

export function WorkflowStepEditor({ steps, onChange }: WorkflowStepEditorProps) {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set());

  const toggleOpen = useCallback((index: number) => {
    setOpenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const updateStep = useCallback(
    (index: number, patch: Partial<WorkflowStepConfig>) => {
      const updated = steps.map((step, i) =>
        i === index ? { ...step, ...patch } : step,
      );
      onChange(updated);
    },
    [steps, onChange],
  );

  const moveStep = useCallback(
    (index: number, direction: -1 | 1) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= steps.length) return;

      const updated = [...steps];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;

      // Recalculate order_index
      const reindexed = updated.map((step, i) => ({
        ...step,
        order_index: i,
      }));

      // Update openIndices to follow the moved item
      setOpenIndices((prev) => {
        const next = new Set<number>();
        for (const idx of prev) {
          if (idx === index) {
            next.add(targetIndex);
          } else if (idx === targetIndex) {
            next.add(index);
          } else {
            next.add(idx);
          }
        }
        return next;
      });

      onChange(reindexed);
    },
    [steps, onChange],
  );

  const deleteStep = useCallback(
    (index: number) => {
      const updated = steps
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, order_index: i }));

      setOpenIndices((prev) => {
        const next = new Set<number>();
        for (const idx of prev) {
          if (idx < index) {
            next.add(idx);
          } else if (idx > index) {
            next.add(idx - 1);
          }
        }
        return next;
      });

      onChange(updated);
    },
    [steps, onChange],
  );

  const addStep = useCallback(() => {
    const newStep = createDefaultStep(steps.length);
    const newIndex = steps.length;
    setOpenIndices((prev) => new Set([...prev, newIndex]));
    onChange([...steps, newStep]);
  }, [steps, onChange]);

  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const isOpen = openIndices.has(index);
        const StepIcon = ICON_MAP[step.icon] ?? FileText;
        const nameValid = step.name === "" || NAME_PATTERN.test(step.name);

        const isPresetConstraint =
          step.constraints === "readonly" || step.constraints === "full";

        return (
          <Collapsible
            key={index}
            open={isOpen}
            onOpenChange={() => toggleOpen(index)}
          >
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              {/* Card Header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-card/80">
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab" />
                <StepIcon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium truncate flex-1">
                  {step.label || step.name || `단계 ${index + 1}`}
                </span>

                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveStep(index, -1);
                    }}
                    aria-label="위로 이동"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={index === steps.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveStep(index, 1);
                    }}
                    aria-label="아래로 이동"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteStep(index);
                    }}
                    aria-label="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>

                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      aria-label={isOpen ? "접기" : "펼치기"}
                    >
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>

              {/* Card Content */}
              <CollapsibleContent>
                <div className="px-4 py-3 border-t border-border space-y-4">
                  {/* name */}
                  <div className="space-y-1.5">
                    <Label htmlFor={`step-name-${index}`} className="text-xs">
                      이름 (영문)
                    </Label>
                    <Input
                      id={`step-name-${index}`}
                      value={step.name}
                      onChange={(e) => updateStep(index, { name: e.target.value })}
                      placeholder="research"
                      className={
                        !nameValid
                          ? "border-destructive focus-visible:ring-destructive"
                          : ""
                      }
                    />
                    {!nameValid ? (
                      <p className="text-xs text-destructive">
                        영문 소문자로 시작, 소문자/숫자/밑줄만 허용됩니다.
                      </p>
                    ) : null}
                  </div>

                  {/* label */}
                  <div className="space-y-1.5">
                    <Label htmlFor={`step-label-${index}`} className="text-xs">
                      표시명
                    </Label>
                    <Input
                      id={`step-label-${index}`}
                      value={step.label}
                      onChange={(e) => updateStep(index, { label: e.target.value })}
                      placeholder="리서치"
                    />
                  </div>

                  {/* icon */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">아이콘</Label>
                    <Select
                      value={step.icon}
                      onValueChange={(val) => updateStep(index, { icon: val })}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="아이콘 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-sm">
                            <div className="flex items-center gap-2">
                              <opt.Icon className="w-4 h-4" />
                              <span>{opt.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* constraints */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">제약 조건</Label>
                    <Select
                      value={isPresetConstraint ? step.constraints : "__custom__"}
                      onValueChange={(val) => {
                        if (val === "__custom__") {
                          updateStep(index, { constraints: "" });
                        } else {
                          updateStep(index, { constraints: val });
                        }
                      }}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="제약 조건 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {CONSTRAINT_PRESETS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-sm">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!isPresetConstraint ? (
                      <Input
                        value={step.constraints}
                        onChange={(e) =>
                          updateStep(index, { constraints: e.target.value })
                        }
                        placeholder="커스텀 제약 조건 입력"
                        className="mt-1.5"
                      />
                    ) : null}
                  </div>

                  {/* auto_advance & review_required */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`step-auto-advance-${index}`}
                        checked={step.auto_advance}
                        onCheckedChange={(checked) =>
                          updateStep(index, { auto_advance: checked === true })
                        }
                      />
                      <Label
                        htmlFor={`step-auto-advance-${index}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        자동 진행
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`step-review-required-${index}`}
                        checked={step.review_required}
                        onCheckedChange={(checked) =>
                          updateStep(index, { review_required: checked === true })
                        }
                      />
                      <Label
                        htmlFor={`step-review-required-${index}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        승인 필요
                      </Label>
                    </div>
                  </div>

                  {/* prompt_template */}
                  <div className="space-y-1.5">
                    <Label htmlFor={`step-prompt-${index}`} className="text-xs">
                      프롬프트 템플릿
                    </Label>
                    <Textarea
                      id={`step-prompt-${index}`}
                      value={step.prompt_template}
                      onChange={(e) =>
                        updateStep(index, { prompt_template: e.target.value })
                      }
                      placeholder={"템플릿 변수: {user_prompt}, {previous_artifact}\n예: {user_prompt}를 기반으로 리서치를 수행하세요. 이전 결과: {previous_artifact}"}
                      className="min-h-[100px] text-sm font-mono"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}

      {/* Add step button */}
      <Button
        variant="outline"
        className="w-full border-dashed"
        onClick={addStep}
      >
        <Plus className="w-4 h-4 mr-2" />
        단계 추가
      </Button>
    </div>
  );
}
