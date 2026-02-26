import { useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  GripVertical,
  FileText,
  Search,
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
import type { WorkflowStepConfig, WorkflowNodeInfo } from "@/types/workflow";

const ICON_MAP: Record<string, LucideIcon> = {
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
};

function createDefaultStep(orderIndex: number): WorkflowStepConfig {
  return {
    node_id: "",
    order_index: orderIndex,
    auto_advance: false,
    review_required: false,
  };
}

interface WorkflowStepEditorProps {
  steps: WorkflowStepConfig[];
  nodes: WorkflowNodeInfo[];
  onChange: (steps: WorkflowStepConfig[]) => void;
}

export function WorkflowStepEditor({ steps, nodes, onChange }: WorkflowStepEditorProps) {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set());

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

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

  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const isOpen = openIndices.has(index);
        const selectedNode = nodeMap.get(step.node_id);
        const StepIcon = selectedNode ? (ICON_MAP[selectedNode.icon] ?? FileText) : FileText;
        const stepLabel = selectedNode?.label ?? `단계 ${index + 1}`;

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
                  {stepLabel}
                </span>
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
                  {/* Node 선택 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">노드 선택</Label>
                    <Select
                      value={step.node_id}
                      onValueChange={(val) => updateStep(index, { node_id: val })}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="노드를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {nodes.map((node) => {
                          const NodeIcon = ICON_MAP[node.icon] ?? FileText;
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
