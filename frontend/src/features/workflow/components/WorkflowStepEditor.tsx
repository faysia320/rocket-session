import { useState, useCallback, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  GripVertical,
  FileText,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { WORKFLOW_ICON_MAP } from "../utils/workflowIcons";
import type { WorkflowStepConfig, WorkflowNodeInfo } from "@/types/workflow";

function createDefaultStep(orderIndex: number): WorkflowStepConfig {
  return {
    node_id: "",
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
  totalSteps: number;
  nodes: WorkflowNodeInfo[];
  nodeMap: Map<string, WorkflowNodeInfo>;
  isOpen: boolean;
  onToggleOpen: () => void;
  onUpdate: (patch: Partial<WorkflowStepConfig>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

function SortableStepCard({
  id,
  step,
  index,
  totalSteps,
  nodes,
  nodeMap,
  isOpen,
  onToggleOpen,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDelete,
}: SortableStepCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const selectedNode = nodeMap.get(step.node_id);
  const StepIcon = selectedNode
    ? (WORKFLOW_ICON_MAP[selectedNode.icon] ?? FileText)
    : FileText;
  const stepLabel = selectedNode?.label ?? `단계 ${index + 1}`;

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* 연결선 (첫 번째 카드 제외) */}
      {index > 0 ? (
        <div className="flex justify-center py-1">
          <div className="flex flex-col items-center">
            <div className="w-px h-3 bg-border" />
            <ChevronDown className="w-3 h-3 text-muted-foreground -my-0.5" />
          </div>
        </div>
      ) : null}

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
            <span className="text-sm font-medium truncate flex-1">
              {stepLabel}
            </span>

            {/* Inline badges */}
            {step.auto_advance ? (
              <Badge variant="outline" className="font-mono text-2xs px-1.5 py-0 shrink-0 text-info border-info/30">
                자동
              </Badge>
            ) : null}
            {step.review_required ? (
              <Badge variant="outline" className="font-mono text-2xs px-1.5 py-0 shrink-0 text-warning border-warning/30">
                승인
              </Badge>
            ) : null}
            {selectedNode ? (
              <Badge variant="secondary" className="font-mono text-2xs shrink-0">
                {selectedNode.constraints}
              </Badge>
            ) : null}

            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={index === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveUp();
                }}
                aria-label="위로 이동"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={index === totalSteps - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveDown();
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
              {/* Node 선택 */}
              <div className="space-y-1.5">
                <Label className="text-xs">노드 선택</Label>
                <Select
                  value={step.node_id}
                  onValueChange={(val) => onUpdate({ node_id: val })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="노드를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {nodes.map((node) => {
                      const NodeIcon = WORKFLOW_ICON_MAP[node.icon] ?? FileText;
                      return (
                        <SelectItem key={node.id} value={node.id} className="text-sm">
                          <div className="flex items-center gap-2">
                            <NodeIcon className="w-4 h-4" />
                            <span>{node.label}</span>
                            <span className="text-muted-foreground text-xs">({node.name})</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* 선택된 노드 정보 표시 */}
              {selectedNode ? (
                <div className="rounded-md bg-muted/50 p-3 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>제약조건:</span>
                    <Badge variant="outline" className="font-mono text-2xs">
                      {selectedNode.constraints}
                    </Badge>
                  </div>
                  {selectedNode.prompt_template ? (
                    <div className="text-xs text-muted-foreground">
                      <span>프롬프트: </span>
                      <span className="text-foreground/70 line-clamp-2">
                        {selectedNode.prompt_template.slice(0, 100)}
                        {selectedNode.prompt_template.length > 100 ? "…" : ""}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* auto_advance & review_required */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`step-auto-advance-${index}`}
                    checked={step.auto_advance}
                    onCheckedChange={(checked) =>
                      onUpdate({ auto_advance: checked === true })
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
                      onUpdate({ review_required: checked === true })
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
  nodes: WorkflowNodeInfo[];
  onChange: (steps: WorkflowStepConfig[]) => void;
}

export function WorkflowStepEditor({ steps, nodes, onChange }: WorkflowStepEditorProps) {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set());

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const sortableIds = useMemo(
    () => steps.map((_, i) => `step-${i}`),
    [steps],
  );

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

      const reindexed = updated.map((step, i) => ({
        ...step,
        order_index: i,
      }));

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

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortableIds.indexOf(active.id as string);
      const newIndex = sortableIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(steps, oldIndex, newIndex).map((step, i) => ({
        ...step,
        order_index: i,
      }));

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
    <div className="space-y-0">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          {steps.map((step, index) => (
            <SortableStepCard
              key={sortableIds[index]}
              id={sortableIds[index]}
              step={step}
              index={index}
              totalSteps={steps.length}
              nodes={nodes}
              nodeMap={nodeMap}
              isOpen={openIndices.has(index)}
              onToggleOpen={() => toggleOpen(index)}
              onUpdate={(patch) => updateStep(index, patch)}
              onMoveUp={() => moveStep(index, -1)}
              onMoveDown={() => moveStep(index, 1)}
              onDelete={() => deleteStep(index)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add step button */}
      <div className={steps.length > 0 ? "pt-3" : ""}>
        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={addStep}
        >
          <Plus className="w-4 h-4 mr-2" />
          단계 추가
        </Button>
      </div>
    </div>
  );
}
