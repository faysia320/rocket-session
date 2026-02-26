import { useState, useCallback, useRef, useMemo } from "react";
import { Loader2 } from "lucide-react";
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
import type {
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
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readyDefinitions = useMemo(() => {
    if (!definitions) return [];
    return [...definitions].sort((a, b) => Number(b.is_builtin) - Number(a.is_builtin));
  }, [definitions]);

  const selectedDefinition = useMemo(
    () => (isCreating ? null : (readyDefinitions.find((d) => d.id === selectedId) ?? readyDefinitions[0] ?? null)),
    [readyDefinitions, selectedId, isCreating],
  );
  const effectiveId = selectedDefinition?.id ?? null;

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setIsCreating(false);
  }, []);

  const handleAdd = useCallback(() => {
    setSelectedId(null);
    setIsCreating(true);
  }, []);

  const handleSave = useCallback(
    (data: { name: string; description?: string; steps: WorkflowStepConfig[] }) => {
      if (isCreating) {
        createMutation.mutate(data, {
          onSuccess: (newDef) => {
            setIsCreating(false);
            setSelectedId(newDef.id);
          },
        });
      } else if (selectedDefinition) {
        updateMutation.mutate({ id: selectedDefinition.id, ...data });
      }
    },
    [isCreating, selectedDefinition, createMutation, updateMutation],
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

  const handleCancelCreate = useCallback(() => {
    setIsCreating(false);
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* 데스크톱: 좌측 사이드바 */}
          {!isMobile ? (
            <WorkflowDefinitionList
              definitions={readyDefinitions}
              selectedId={effectiveId}
              onSelect={handleSelect}
              onAdd={handleAdd}
              onImport={() => fileInputRef.current?.click()}
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

            <WorkflowDefinitionDetail
              definition={isCreating ? null : selectedDefinition}
              isCreating={isCreating}
              onSave={handleSave}
              onExport={handleExport}
              onDelete={handleDelete}
              onCancelCreate={handleCancelCreate}
            />
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
    </div>
  );
}
