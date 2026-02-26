import { useState, useCallback, useRef, useMemo } from "react";
import { Workflow, Plus, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useMediaQuery";
import {
  useWorkflowDefinitions,
  useDeleteWorkflowDefinition,
  useImportWorkflowDefinition,
  useCreateWorkflowDefinition,
  useUpdateWorkflowDefinition,
} from "../hooks/useWorkflowDefinitions";
import { workflowDefinitionApi } from "@/lib/api/workflowDefinition.api";
import { WorkflowDefinitionList } from "./WorkflowDefinitionList";
import { WorkflowDefinitionDetail } from "./WorkflowDefinitionDetail";
import { WorkflowDefinitionFormDialog } from "./WorkflowDefinitionFormDialog";
import type {
  WorkflowDefinitionInfo,
  WorkflowDefinitionExport,
  WorkflowStepConfig,
} from "@/types/workflow";

export function WorkflowDefinitionsPage() {
  const { data: definitions, isLoading } = useWorkflowDefinitions();
  const deleteMutation = useDeleteWorkflowDefinition();
  const importMutation = useImportWorkflowDefinition();
  const createMutation = useCreateWorkflowDefinition();
  const updateMutation = useUpdateWorkflowDefinition();
  const isMobile = useIsMobile();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingDefinition, setEditingDefinition] = useState<WorkflowDefinitionInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readyDefinitions = useMemo(() => definitions ?? [], [definitions]);

  const selectedDefinition = useMemo(
    () => readyDefinitions.find((d) => d.id === selectedId) ?? readyDefinitions[0] ?? null,
    [readyDefinitions, selectedId],
  );
  const effectiveId = selectedDefinition?.id ?? null;

  const handleSelect = useCallback((id: string) => setSelectedId(id), []);

  const handleAdd = useCallback(() => {
    setEditingDefinition(null);
    setFormDialogOpen(true);
  }, []);

  const handleEdit = useCallback(() => {
    if (selectedDefinition) {
      setEditingDefinition(selectedDefinition);
      setFormDialogOpen(true);
    }
  }, [selectedDefinition]);

  const handleSave = useCallback(
    (data: { name: string; description?: string; steps: WorkflowStepConfig[] }) => {
      if (editingDefinition) {
        updateMutation.mutate({ id: editingDefinition.id, ...data });
      } else {
        createMutation.mutate(data);
      }
    },
    [editingDefinition, createMutation, updateMutation],
  );

  const handleExport = useCallback(async () => {
    if (!selectedDefinition) return;
    try {
      const data = await workflowDefinitionApi.export(selectedDefinition.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workflow-def-${selectedDefinition.name.replace(/\s+/g, "-")}.json`;
      document.body.appendChild(a);
      try {
        a.click();
      } finally {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      toast.success(`"${selectedDefinition.name}" 워크플로우 정의를 내보냈습니다`);
    } catch (err) {
      toast.error(`내보내기 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [selectedDefinition]);

  const handleDelete = useCallback(() => {
    if (!selectedDefinition || selectedDefinition.is_builtin) return;
    deleteMutation.mutate(selectedDefinition.id, {
      onSuccess: () => {
        if (selectedId === selectedDefinition.id) {
          setSelectedId(null);
        }
      },
    });
  }, [selectedDefinition, selectedId, deleteMutation]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string) as WorkflowDefinitionExport;
          if (!data.version || !data.definition?.name) {
            toast.error("유효하지 않은 워크플로우 정의 파일입니다");
            return;
          }
          await importMutation.mutateAsync(data);
        } catch (err) {
          toast.error(`가져오기 실패: ${err instanceof Error ? err.message : String(err)}`);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [importMutation],
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-lg font-semibold text-foreground flex items-center gap-2">
              <Workflow className="h-5 w-5 text-primary" />
              Workflow Definitions
            </h1>
            <p className="font-mono text-xs text-muted-foreground">
              {isLoading
                ? "로딩 중…"
                : readyDefinitions.length > 0
                  ? `${readyDefinitions.length}개 정의`
                  : "워크플로우 정의를 추가하세요"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-xs gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              가져오기
            </Button>
            <Button
              size="sm"
              className="font-mono text-xs gap-1.5"
              onClick={handleAdd}
            >
              <Plus className="h-3.5 w-3.5" />
              새 정의 만들기
            </Button>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : readyDefinitions.length === 0 ? (
        <EmptyState onAdd={handleAdd} />
      ) : (
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* 데스크톱: 좌측 사이드바 */}
          {!isMobile ? (
            <WorkflowDefinitionList
              definitions={readyDefinitions}
              selectedId={effectiveId}
              onSelect={handleSelect}
            />
          ) : null}

          {/* 메인 영역 */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* 모바일: 셀렉트 드롭다운 */}
            {isMobile ? (
              <div className="px-4 py-2 border-b border-border shrink-0">
                <Select value={effectiveId ?? ""} onValueChange={handleSelect}>
                  <SelectTrigger className="h-8 font-mono text-xs">
                    <SelectValue placeholder="워크플로우 정의 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {readyDefinitions.map((def) => (
                      <SelectItem key={def.id} value={def.id} className="font-mono text-xs">
                        {def.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {selectedDefinition ? (
              <WorkflowDefinitionDetail
                definition={selectedDefinition}
                onEdit={handleEdit}
                onExport={handleExport}
                onDelete={handleDelete}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <span className="font-mono text-sm text-muted-foreground">
                  좌측에서 워크플로우 정의를 선택하세요
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
      />

      <WorkflowDefinitionFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        editingDefinition={editingDefinition}
        onSave={handleSave}
      />
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <Workflow className="h-16 w-16 text-muted-foreground/20" />
      <p className="font-mono text-sm text-muted-foreground">
        저장된 워크플로우 정의가 없습니다
      </p>
      <p className="font-mono text-xs text-muted-foreground/60">
        워크플로우 정의를 생성하여 세션에서 사용하세요
      </p>
      <Button
        variant="outline"
        onClick={onAdd}
        className="font-mono text-xs"
      >
        <Plus className="h-3 w-3 mr-1" />
        새 정의 만들기
      </Button>
    </div>
  );
}
