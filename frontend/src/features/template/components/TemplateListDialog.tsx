import { useState, useRef } from "react";
import { FileStack, Plus, Pencil, Trash2, Download, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useTemplates,
  useDeleteTemplate,
  useImportTemplate,
} from "@/features/template/hooks/useTemplates";
import { templatesApi } from "@/lib/api/templates.api";
import { TemplateFormDialog } from "./TemplateFormDialog";
import type { TemplateInfo, TemplateExport } from "@/types";

interface TemplateListDialogProps {
  children: React.ReactNode;
}

export function TemplateListDialog({ children }: TemplateListDialogProps) {
  const [open, setOpen] = useState(false);
  const { data: templates, isLoading } = useTemplates();
  const deleteMutation = useDeleteTemplate();
  const importMutation = useImportTemplate();

  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async (tpl: TemplateInfo) => {
    try {
      const data = await templatesApi.export(tpl.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `template-${tpl.name.replace(/\s+/g, "-")}.json`;
      document.body.appendChild(a);
      try {
        a.click();
      } finally {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      toast.success(`"${tpl.name}" 템플릿을 내보냈습니다`);
    } catch (err) {
      toast.error(`내보내기 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as TemplateExport;
        if (!data.version || !data.template?.name) {
          toast.error("유효하지 않은 템플릿 파일입니다");
          return;
        }
        await importMutation.mutateAsync(data);
      } catch (err) {
        toast.error(`불러오기 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
    // 같은 파일 다시 선택 가능하도록 value 초기화
    e.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm flex items-center gap-2">
            <FileStack className="h-4 w-4 text-primary" />
            세션 템플릿 관리
          </DialogTitle>
        </DialogHeader>

        {/* 상단 액션 */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs gap-1.5"
            onClick={() => {
              setEditingTemplate(null);
              setFormDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />새 템플릿
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            불러오기
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </div>

        {/* 템플릿 목록 */}
        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="py-8 text-center font-mono text-xs text-muted-foreground">
              불러오는 중…
            </div>
          ) : !templates?.length ? (
            <div className="py-8 text-center font-mono text-xs text-muted-foreground">
              저장된 템플릿이 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-start gap-3 p-3 rounded-md border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-semibold text-foreground truncate">
                      {tpl.name}
                    </p>
                    {tpl.description ? (
                      <p className="font-mono text-2xs text-muted-foreground mt-0.5 truncate">
                        {tpl.description}
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2 mt-1">
                      {tpl.work_dir ? (
                        <span className="font-mono text-2xs text-muted-foreground/60 truncate max-w-[200px]">
                          {tpl.work_dir}
                        </span>
                      ) : null}
                      {tpl.system_prompt ? (
                        <span
                          className={cn(
                            "font-mono text-2xs px-1.5 py-0.5 rounded",
                            "bg-primary/10 text-primary/70",
                          )}
                        >
                          prompt
                        </span>
                      ) : null}
                      {tpl.mode === "plan" ? (
                        <span
                          className={cn(
                            "font-mono text-2xs px-1.5 py-0.5 rounded",
                            "bg-info/10 text-info/70",
                          )}
                        >
                          plan
                        </span>
                      ) : null}
                      {tpl.model ? (
                        <span
                          className={cn(
                            "font-mono text-2xs px-1.5 py-0.5 rounded",
                            "bg-secondary text-muted-foreground",
                          )}
                        >
                          {tpl.model}
                        </span>
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
                            setEditingTemplate(tpl);
                            setFormDialogOpen(true);
                          }}
                          aria-label="수정"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="font-mono text-xs">수정</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleExport(tpl)}
                          aria-label="내보내기"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="font-mono text-xs">내보내기</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive/60 hover:text-destructive"
                          onClick={() => deleteMutation.mutate(tpl.id)}
                          aria-label="삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="font-mono text-xs">삭제</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>

      <TemplateFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        template={editingTemplate}
      />
    </Dialog>
  );
}
