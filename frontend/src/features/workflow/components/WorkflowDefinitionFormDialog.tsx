import { useState, useEffect } from "react";
import { GitBranch, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { WorkflowStepEditor } from "./WorkflowStepEditor";
import type { WorkflowDefinitionInfo, WorkflowStepConfig } from "@/types/workflow";

interface WorkflowDefinitionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingDefinition?: WorkflowDefinitionInfo | null;
  onSave: (data: { name: string; description?: string; steps: WorkflowStepConfig[] }) => void;
}

interface FormData {
  name: string;
  description: string;
  steps: WorkflowStepConfig[];
}

const DEFAULT_STEP: WorkflowStepConfig = {
  name: "step_1",
  label: "Step 1",
  icon: "FileText",
  constraints: "readonly",
  auto_advance: false,
  review_required: false,
  order_index: 0,
  prompt_template: "",
};

function getInitialFormData(definition?: WorkflowDefinitionInfo | null): FormData {
  return {
    name: definition?.name ?? "",
    description: definition?.description ?? "",
    steps: definition?.steps?.length ? definition.steps : [{ ...DEFAULT_STEP }],
  };
}

export function WorkflowDefinitionFormDialog({
  open,
  onOpenChange,
  editingDefinition,
  onSave,
}: WorkflowDefinitionFormDialogProps) {
  const isEditMode = !!editingDefinition;

  const [formData, setFormData] = useState<FormData>(getInitialFormData(editingDefinition));

  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData(editingDefinition));
    }
  }, [open, editingDefinition]);

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) return;

    onSave({
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      steps: formData.steps,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="font-mono text-sm flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            {isEditMode ? "워크플로우 정의 수정" : "새 워크플로우 정의"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 pb-6 space-y-5">
            {/* -- 기본 정보 -- */}
            <div className="space-y-2">
              <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                이름 <span className="text-destructive">*</span>
              </Label>
              <Input
                className="font-mono text-xs"
                placeholder="예: 코드 리뷰 워크플로우"
                value={formData.name}
                onChange={(e) => update("name", e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                설명
              </Label>
              <Input
                className="font-mono text-xs"
                placeholder="이 워크플로우의 용도를 설명하세요"
                value={formData.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>

            <Separator />

            {/* -- 단계 편집 -- */}
            <div className="space-y-2">
              <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
                단계 구성
              </Label>
              <WorkflowStepEditor
                steps={formData.steps}
                onChange={(steps) => update("steps", steps)}
              />
            </div>
          </div>
        </ScrollArea>

        {/* -- 하단 액션 -- */}
        <DialogFooter className="flex gap-2 px-6 py-4 border-t border-border shrink-0">
          <Button
            className="flex-1 font-mono text-xs font-semibold gap-1.5"
            onClick={handleSubmit}
            disabled={!formData.name.trim()}
          >
            <Check className="h-3.5 w-3.5" />
            {isEditMode ? "저장" : "생성"}
          </Button>
          <Button variant="ghost" className="font-mono text-xs" onClick={() => onOpenChange(false)}>
            취소
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
