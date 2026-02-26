import { useState, useCallback, useMemo } from "react";
import { Blocks, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/useMediaQuery";
import {
  useWorkflowNodes,
  useCreateWorkflowNode,
  useUpdateWorkflowNode,
  useDeleteWorkflowNode,
} from "../hooks/useWorkflowNodes";
import { WorkflowNodeList } from "./WorkflowNodeList";
import { WorkflowNodeDetail } from "./WorkflowNodeDetail";
import type { CreateWorkflowNodeRequest, UpdateWorkflowNodeRequest } from "@/types/workflow";

export function WorkflowNodesPage() {
  const { data: nodes, isLoading } = useWorkflowNodes();
  const createMutation = useCreateWorkflowNode();
  const updateMutation = useUpdateWorkflowNode();
  const deleteMutation = useDeleteWorkflowNode();
  const isMobile = useIsMobile();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const readyNodes = useMemo(() => nodes ?? [], [nodes]);

  const selectedNode = useMemo(
    () => readyNodes.find((n) => n.id === selectedId) ?? null,
    [readyNodes, selectedId],
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setIsCreating(false);
  }, []);

  const handleAdd = useCallback(() => {
    setSelectedId(null);
    setIsCreating(true);
  }, []);

  const handleSave = useCallback(
    (data: CreateWorkflowNodeRequest | (UpdateWorkflowNodeRequest & { id: string })) => {
      if ("id" in data) {
        const { id, ...req } = data;
        updateMutation.mutate({ id, ...req });
      } else {
        createMutation.mutate(data, {
          onSuccess: (newNode) => {
            setIsCreating(false);
            setSelectedId(newNode.id);
          },
        });
      }
    },
    [createMutation, updateMutation],
  );

  const handleDelete = useCallback(() => {
    if (!selectedNode || selectedNode.is_builtin) return;
    deleteMutation.mutate(selectedNode.id, {
      onSuccess: () => {
        setSelectedId(null);
      },
    });
  }, [selectedNode, deleteMutation]);

  const handleCancelCreate = useCallback(() => {
    setIsCreating(false);
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-lg font-semibold text-foreground flex items-center gap-2">
              <Blocks className="h-5 w-5 text-primary" />
              Workflow Nodes
            </h1>
            <p className="font-mono text-xs text-muted-foreground">
              {isLoading
                ? "로딩 중…"
                : readyNodes.length > 0
                  ? `${readyNodes.length}개 노드`
                  : "워크플로우 노드를 추가하세요"}
            </p>
          </div>
          <Button
            size="sm"
            className="font-mono text-xs gap-1.5"
            onClick={handleAdd}
          >
            <Plus className="h-3.5 w-3.5" />
            새 노드 만들기
          </Button>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : readyNodes.length === 0 && !isCreating ? (
        <EmptyState onAdd={handleAdd} />
      ) : (
        <div className="flex-1 flex overflow-hidden min-h-0">
          {!isMobile ? (
            <WorkflowNodeList
              nodes={readyNodes}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          ) : null}

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {isMobile ? (
              <div className="px-4 py-2 border-b border-border shrink-0">
                <Select value={selectedId ?? ""} onValueChange={handleSelect}>
                  <SelectTrigger className="h-8 font-mono text-xs">
                    <SelectValue placeholder="워크플로우 노드 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {readyNodes.map((node) => (
                      <SelectItem key={node.id} value={node.id} className="font-mono text-xs">
                        {node.label} ({node.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <WorkflowNodeDetail
              node={isCreating ? null : selectedNode}
              isCreating={isCreating}
              onSave={handleSave}
              onDelete={handleDelete}
              onCancelCreate={handleCancelCreate}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <Blocks className="h-16 w-16 text-muted-foreground/20" />
      <p className="font-mono text-sm text-muted-foreground">
        저장된 워크플로우 노드가 없습니다
      </p>
      <p className="font-mono text-xs text-muted-foreground/60">
        워크플로우 노드를 생성하여 워크플로우 정의에서 사용하세요
      </p>
      <Button
        variant="outline"
        onClick={onAdd}
        className="font-mono text-xs"
      >
        <Plus className="h-3 w-3 mr-1" />
        새 노드 만들기
      </Button>
    </div>
  );
}
