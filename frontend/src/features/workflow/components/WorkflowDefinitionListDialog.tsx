import { useState, useRef } from "react";
import { Workflow, Plus, Pencil, Trash2, Download, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  useWorkflowDefinitions,
  useDeleteWorkflowDefinition,
  useImportWorkflowDefinition,
} from "../hooks/useWorkflowDefinitions";
import { workflowDefinitionApi } from "@/lib/api/workflowDefinition.api";
import { WorkflowDefinitionFormDialog } from "./WorkflowDefinitionFormDialog";
import type { WorkflowDefinitionInfo, WorkflowDefinitionExport } from "@/types/workflow";

interface WorkflowDefinitionListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkflowDefinitionListDialog({
  open,
  onOpenChange,
}: WorkflowDefinitionListDialogProps) {
  const { data: definitions, isLoading } = useWorkflowDefinitions();
  const deleteMutation = useDeleteWorkflowDefinition();
  const importMutation = useImportWorkflowDefinition();

  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingDefinition, setEditingDefinition] =
    useState<WorkflowDefinitionInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async (def: WorkflowDefinitionInfo) => {
    try {
      const data = await workflowDefinitionApi.export(def.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workflow-def-${def.name.replace(/\s+/g, "-")}.json`;
      document.body.appendChild(a);
      try {
        a.click();
      } finally {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      toast.success(`"${def.name}" 워크플로우 정의를 내보냈습니다`);
    } catch (err) {
      toast.error(
        `내보내기 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(
          ev.target?.result as string,
        ) as WorkflowDefinitionExport;
        if (!data.version || !data.definition?.name) {
          toast.error("유효하지 않은 워크플로우 정의 파일입니다");
          return;
        }
        await importMutation.mutateAsync(data);
      } catch (err) {
        toast.error(
          `가져오기 실패: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    };
    reader.readAsText(file);
    // 같은 파일 다시 선택 가능하도록 value 초기화
    e.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm flex items-center gap-2">
            <Workflow className="h-4 w-4 text-primary" />
            워크플로우 정의 관리
          </DialogTitle>
        </DialogHeader>

        {/* 상단 액션 */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs gap-1.5"
            onClick={() => {
              setEditingDefinition(null);
              setFormDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            새 정의 만들기
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            가져오기
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </div>

        {/* 워크플로우 정의 목록 */}
        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="py-8 text-center font-mono text-xs text-muted-foreground">
              불러오는 중…
            </div>
          ) : !definitions?.length ? (
            <div className="py-8 text-center font-mono text-xs text-muted-foreground">
              저장된 워크플로우 정의가 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              {definitions.map((def) => (
                <div
                  key={def.id}
                  className="flex items-start gap-3 p-3 rounded-md border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-semibold text-foreground truncate">
                      {def.name}
                    </p>
                    {def.description ? (
                      <p className="font-mono text-2xs text-muted-foreground mt-0.5 truncate">
                        {def.description}
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="secondary"
                        className="font-mono text-2xs px-1.5 py-0"
                      >
                        {def.steps.length}단계
                      </Badge>
                      {def.is_builtin ? (
                        <Badge
                          variant="outline"
                          className="font-mono text-2xs px-1.5 py-0"
                        >
                          기본 제공
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingDefinition(def);
                            setFormDialogOpen(true);
                          }}
                          aria-label="수정"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="font-mono text-xs">
                        수정
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleExport(def)}
                          aria-label="내보내기"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="font-mono text-xs">
                        내보내기
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive/60 hover:text-destructive"
                          onClick={() => deleteMutation.mutate(def.id)}
                          disabled={def.is_builtin}
                          aria-label="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="font-mono text-xs">
                        {def.is_builtin
                          ? "기본 제공 정의는 삭제할 수 없습니다"
                          : "삭제"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>

      <WorkflowDefinitionFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        definition={editingDefinition}
      />
    </Dialog>
  );
}
