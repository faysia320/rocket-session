import { useState, useCallback, useMemo } from "react";
import { ChevronDown, ChevronUp, Trash2, Plus, GripVertical, FileText } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { WORKFLOW_ICON_MAP } from "../utils/workflowIcons";
import type { WorkflowStepConfig } from "@/types/workflow";

const CONSTRAINT_OPTIONS = [
  { value: "readonly", label: "Readonly" },
  { value: "full", label: "Full" },
];

const ICON_OPTIONS = [
  "Search",
  "FileText",
  "Code",
  "CheckCircle",
  "Settings",
  "Database",
  "Globe",
  "Zap",
  "Shield",
  "Layers",
];

function createDefaultStep(orderIndex: number): WorkflowStepConfig {
  return {
    name: "",
    label: "",
    icon: "FileText",
    prompt_template: "",
    constraints: "readonly",
    order_index: orderIndex,
    auto_advance: false,
    review_required: false,
  };
}

/* ─── SortableStepCard ──────────────────────────────────── */

interface SortableStepCardProps {
  id: string;
  step: WorkflowStepConfig;
  index: number;
  isOpen: boolean;
  onToggleOpen: () => void;
  onUpdate: (patch: Partial<WorkflowStepConfig>) => void;
  onDelete: () => void;
}

function SortableStepCard({
  id,
  step,
  index,
  isOpen,
  onToggleOpen,
  onUpdate,
  onDelete,
}: SortableStepCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const StepIcon = WORKFLOW_ICON_MAP[step.icon] ?? FileText;
  const stepLabel = step.label || `단계 ${index + 1}`;

  return (
    <div ref={setNodeRef} style={style}>
      <Collapsible open={isOpen} onOpenChange={onToggleOpen}>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Card Header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-card/80">
            {/* Drag Handle */}
            <button
              type="button"
              className="cursor-grab active:cursor-grabbing touch-none shrink-0"
              aria-label="드래그하여 순서 변경"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Step number */}
            <span className="font-mono text-2xs text-muted-foreground bg-muted rounded-full w-5 h-5 flex items-center justify-center shrink-0">
              {index + 1}
            </span>

            <StepIcon className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-medium truncate flex-1">{stepLabel}</span>

            {/* Inline badges */}
            {step.auto_advance ? (
              <Badge
                variant="outline"
                className="font-mono text-2xs px-1.5 py-0 shrink-0 text-info border-info/30"
              >
                자동
              </Badge>
            ) : null}
            {step.review_required ? (
              <Badge
                variant="outline"
                className="font-mono text-2xs px-1.5 py-0 shrink-0 text-warning border-warning/30"
              >
                승인
              </Badge>
            ) : null}
            <Badge variant="secondary" className="font-mono text-2xs shrink-0">
              {step.constraints}
            </Badge>

            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
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
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* Card Content — Inline Editing */}
          <CollapsibleContent>
            <div className="px-4 py-3 border-t border-border space-y-4">
              {/* name + label */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">이름 (name)</Label>
                  <Input
                    className="font-mono text-xs h-8"
                    value={step.name}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    placeholder="research"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">라벨 (label)</Label>
                  <Input
                    className="font-mono text-xs h-8"
                    value={step.label}
                    onChange={(e) => onUpdate({ label: e.target.value })}
                    placeholder="Research"
                  />
                </div>
              </div>

              {/* icon + constraints */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">아이콘</Label>
                  <Select value={step.icon} onValueChange={(val) => onUpdate({ icon: val })}>
                    <SelectTrigger className="h-8 font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map((icon) => (
                        <SelectItem key={icon} value={icon} className="font-mono text-xs">
                          {icon}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">제약조건</Label>
                  <Select
                    value={step.constraints}
                    onValueChange={(val) => onUpdate({ constraints: val })}
                  >
                    <SelectTrigger className="h-8 font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONSTRAINT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="font-mono text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* prompt_template */}
              <div className="space-y-1.5">
                <Label className="text-xs">프롬프트 템플릿</Label>
                <Textarea
                  className="font-mono text-xs min-h-[120px] resize-y"
                  value={step.prompt_template}
                  onChange={(e) => onUpdate({ prompt_template: e.target.value })}
                  placeholder="프롬프트 템플릿을 입력하세요. {user_prompt}, {previous_artifact} 변수를 사용할 수 있습니다."
                />
              </div>

              {/* auto_advance & review_required */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`step-auto-advance-${index}`}
                    checked={step.auto_advance}
                    onCheckedChange={(checked) => onUpdate({ auto_advance: checked === true })}
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
                    onCheckedChange={(checked) => onUpdate({ review_required: checked === true })}
                  />
                  <Label
                    htmlFor={`step-review-required-${index}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    승인 필요
                  </Label>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

/* ─── WorkflowStepEditor ────────────────────────────────── */

interface WorkflowStepEditorProps {
  steps: WorkflowStepConfig[];
  onChange: (steps: WorkflowStepConfig[]) => void;
}

export function WorkflowStepEditor({ steps, onChange }: WorkflowStepEditorProps) {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set());

  const sortableIds = useMemo(() => steps.map((_, i) => `step-${i}`), [steps]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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
      const updated = steps.map((step, i) => (i === index ? { ...step, ...patch } : step));
      onChange(updated);
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

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortableIds.indexOf(active.id as string);
      const newIndex = sortableIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(steps, oldIndex, newIndex).map(
        (step: WorkflowStepConfig, i: number) => ({
          ...step,
          order_index: i,
        }),
      );

      setOpenIndices((prev) => {
        const next = new Set<number>();
        for (const idx of prev) {
          if (idx === oldIndex) {
            next.add(newIndex);
          } else if (oldIndex < newIndex && idx > oldIndex && idx <= newIndex) {
            next.add(idx - 1);
          } else if (oldIndex > newIndex && idx >= newIndex && idx < oldIndex) {
            next.add(idx + 1);
          } else {
            next.add(idx);
          }
        }
        return next;
      });

      onChange(reordered);
    },
    [steps, sortableIds, onChange],
  );

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {steps.map((step, index) => (
            <SortableStepCard
              key={sortableIds[index]}
              id={sortableIds[index]}
              step={step}
              index={index}
              isOpen={openIndices.has(index)}
              onToggleOpen={() => toggleOpen(index)}
              onUpdate={(patch) => updateStep(index, patch)}
              onDelete={() => deleteStep(index)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add step button */}
      <div className={steps.length > 0 ? "pt-3" : ""}>
        <Button variant="outline" className="w-full border-dashed" onClick={addStep}>
          <Plus className="w-4 h-4 mr-2" />
          단계 추가
        </Button>
      </div>
    </div>
  );
}
