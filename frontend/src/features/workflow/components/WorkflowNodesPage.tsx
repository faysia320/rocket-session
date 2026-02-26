import { useState, useCallback, useMemo } from "react";
import { Loader2 } from "lucide-react";
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
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden min-h-0">
          {!isMobile ? (
            <WorkflowNodeList
              nodes={readyNodes}
              selectedId={selectedId}
              onSelect={handleSelect}
              onAdd={handleAdd}
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
