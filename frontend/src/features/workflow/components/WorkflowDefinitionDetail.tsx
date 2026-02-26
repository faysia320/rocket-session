import { useState, useCallback, useEffect } from "react";
import { Pencil, Download, Trash2, Save, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { WorkflowStepEditor } from "./WorkflowStepEditor";
import { WORKFLOW_ICON_MAP } from "../utils/workflowIcons";
import { cn } from "@/lib/utils";
import type { WorkflowDefinitionInfo, WorkflowStepConfig } from "@/types/workflow";

const CONSTRAINT_LABELS: Record<string, string> = {
  readonly: "읽기 전용",
  full: "전체",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface WorkflowDefinitionDetailProps {
  definition: WorkflowDefinitionInfo | null;
  isCreating?: boolean;
  onSave: (data: { name: string; description?: string; steps: WorkflowStepConfig[] }) => void;
  onExport: () => void;
  onDelete: () => void;
  onCancelCreate?: () => void;
}

export function WorkflowDefinitionDetail({
  definition,
  isCreating = false,
  onSave,
  onExport,
  onDelete,
  onCancelCreate,
}: WorkflowDefinitionDetailProps) {
  const [isEditing, setIsEditing] = useState(isCreating);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(new Set());
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    steps: [] as WorkflowStepConfig[],
  });

  useEffect(() => {
    if (isCreating) {
      setFormData({ name: "", description: "", steps: [] });
      setIsEditing(true);
    } else if (definition) {
      setFormData({
        name: definition.name,
        description: definition.description ?? "",
        steps: definition.steps.map((s) => ({
          name: s.name,
          label: s.label,
          icon: s.icon,
          prompt_template: s.prompt_template,
          constraints: s.constraints,
          order_index: s.order_index,
          review_required: s.review_required,
        })),
      });
      setIsEditing(false);
      setExpandedPrompts(new Set());
    }
  }, [definition, isCreating]);

  const handleSave = useCallback(() => {
    onSave({
      name: formData.name,
      description: formData.description || undefined,
      steps: formData.steps,
    });
    setIsEditing(false);
  }, [formData, onSave]);

  const handleCancel = useCallback(() => {
    if (isCreating) {
      onCancelCreate?.();
    } else if (definition) {
      setFormData({
        name: definition.name,
        description: definition.description ?? "",
        steps: definition.steps.map((s) => ({
          name: s.name,
          label: s.label,
          icon: s.icon,
          prompt_template: s.prompt_template,
          constraints: s.constraints,
          order_index: s.order_index,
          review_required: s.review_required,
        })),
      });
      setIsEditing(false);
    }
  }, [isCreating, definition, onCancelCreate]);

  if (!definition && !isCreating) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="font-mono text-sm text-muted-foreground">
          좌측에서 워크플로우 정의를 선택하세요
        </span>
      </div>
    );
  }

  const isBuiltin = definition?.is_builtin ?? false;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* 액션 바 */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border">
        <span className="font-mono text-sm font-semibold text-foreground truncate">
          {isCreating ? "새 정의" : definition?.name}
        </span>
        {isBuiltin ? (
          <Badge variant="outline" className="font-mono text-2xs px-1.5 py-0 shrink-0">
            기본 제공
          </Badge>
        ) : null}

        <div className="flex-1" />

        {isEditing ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 font-mono text-xs gap-1"
              onClick={handleCancel}
            >
              <X className="h-3 w-3" />
              취소
            </Button>
            <Button
              size="sm"
              className="h-7 font-mono text-xs gap-1"
              onClick={handleSave}
              disabled={!formData.name || formData.steps.length === 0}
            >
              <Save className="h-3 w-3" />
              저장
            </Button>
          </>
        ) : (
          <>
            {!isBuiltin ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setIsEditing(true)}
                    aria-label="수정"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="font-mono text-xs">수정</TooltipContent>
              </Tooltip>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onExport}
                  aria-label="내보내기"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="font-mono text-xs">내보내기</TooltipContent>
            </Tooltip>
            {!isBuiltin ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive/60 hover:text-destructive"
                    onClick={onDelete}
                    aria-label="삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="font-mono text-xs">삭제</TooltipContent>
              </Tooltip>
            ) : null}
          </>
        )}
      </div>

      {/* 콘텐츠 */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-4 space-y-6">
          {isEditing ? (
            <>
              <div className="space-y-1.5">
                <Label className="font-mono text-xs">이름</Label>
                <Input
                  className="font-mono text-xs h-8"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="워크플로우 정의 이름"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-xs">설명</Label>
                <Input
                  className="font-mono text-xs h-8"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="설명 (선택)"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-xs">단계 구성</Label>
                <WorkflowStepEditor
                  steps={formData.steps}
                  onChange={(steps) => setFormData((prev) => ({ ...prev, steps }))}
                />
              </div>
            </>
          ) : definition ? (
            <>
              {/* 설명 */}
              <div>
                <h3 className="font-mono text-xs font-semibold text-muted-foreground mb-1">설명</h3>
                <p className="font-mono text-xs text-foreground">
                  {definition.description || "설명 없음"}
                </p>
              </div>

              {/* 단계 목록 */}
              <div>
                <h3 className="font-mono text-xs font-semibold text-muted-foreground mb-2">
                  단계 구성 ({definition.steps.length}단계)
                </h3>
                <div className="space-y-2">
                  {definition.steps.map((step, index) => {
                    const StepIcon = WORKFLOW_ICON_MAP[step.icon] ?? FileText;
                    return (
                      <div
                        key={index}
                        className="rounded-lg border border-border bg-card p-3 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-2xs text-muted-foreground w-5 text-right shrink-0">
                            {index + 1}.
                          </span>
                          <StepIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-mono text-xs font-medium text-foreground">
                            {step.label || step.name}
                          </span>
                          {step.label && step.name ? (
                            <span className="font-mono text-2xs text-muted-foreground">
                              ({step.name})
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1.5 pl-7">
                          <Badge variant="secondary" className="font-mono text-2xs px-1.5 py-0">
                            {CONSTRAINT_LABELS[step.constraints] ?? step.constraints}
                          </Badge>

                          {step.review_required ? (
                            <Badge
                              variant="outline"
                              className="font-mono text-2xs px-1.5 py-0 text-warning border-warning/30"
                            >
                              승인 필요
                            </Badge>
                          ) : null}
                        </div>

                        {step.prompt_template
                          ? (() => {
                              const lineCount = step.prompt_template.split("\n").length;
                              const isLong = lineCount > 30;
                              const isExpanded = expandedPrompts.has(index);
                              return (
                                <div className="pl-7">
                                  <p
                                    className={cn(
                                      "font-mono text-2xs text-muted-foreground whitespace-pre-wrap",
                                      isLong && !isExpanded ? "line-clamp-[30]" : "",
                                    )}
                                  >
                                    {step.prompt_template}
                                  </p>
                                  {isLong ? (
                                    <button
                                      type="button"
                                      className="font-mono text-2xs text-primary hover:underline mt-1"
                                      onClick={() =>
                                        setExpandedPrompts((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(index)) next.delete(index);
                                          else next.add(index);
                                          return next;
                                        })
                                      }
                                    >
                                      {isExpanded ? "접기" : `펼치기 (${lineCount}줄)`}
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })()
                          : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 메타 정보 */}
              <div className="flex items-center gap-4 pt-2 border-t border-border">
                <span className="font-mono text-2xs text-muted-foreground">
                  생성: {formatDate(definition.created_at)}
                </span>
                <span className="font-mono text-2xs text-muted-foreground">
                  수정: {formatDate(definition.updated_at)}
                </span>
              </div>
            </>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
