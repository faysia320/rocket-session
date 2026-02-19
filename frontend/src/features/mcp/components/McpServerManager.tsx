import { useState } from "react";
import { Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { McpServerForm } from "./McpServerForm";
import { McpServerList } from "./McpServerList";
import {
  useMcpServers,
  useCreateMcpServer,
  useUpdateMcpServer,
  useDeleteMcpServer,
  useSystemMcpServers,
  useImportSystemMcpServers,
} from "../hooks/useMcpServers";
import type { McpServerInfo, CreateMcpServerRequest } from "@/types";

export function McpServerManager() {
  const { data: servers = [] } = useMcpServers();
  const createMutation = useCreateMcpServer();
  const updateMutation = useUpdateMcpServer();
  const deleteMutation = useDeleteMcpServer();
  const { data: systemServers, refetch: fetchSystem } = useSystemMcpServers();
  const importMutation = useImportSystemMcpServers();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<McpServerInfo | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const handleCreate = async (data: CreateMcpServerRequest) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success(`MCP 서버 "${data.name}" 추가됨`);
      setFormOpen(false);
    } catch (e) {
      toast.error(
        `추가 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}`,
      );
    }
  };

  const handleUpdate = async (data: CreateMcpServerRequest) => {
    if (!editTarget) return;
    try {
      await updateMutation.mutateAsync({ id: editTarget.id, data });
      toast.success(`MCP 서버 "${data.name}" 수정됨`);
      setEditTarget(null);
      setFormOpen(false);
    } catch (e) {
      toast.error(
        `수정 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}`,
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("MCP 서버 삭제됨");
    } catch (e) {
      toast.error(
        `삭제 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}`,
      );
    }
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      await updateMutation.mutateAsync({ id, data: { enabled } });
    } catch {
      toast.error("상태 변경 실패");
    }
  };

  const handleOpenImport = async () => {
    setImportOpen(true);
    await fetchSystem();
  };

  const handleImportAll = async () => {
    try {
      const importable = systemServers?.filter((s) => !s.already_imported);
      if (!importable || importable.length === 0) {
        toast.info("가져올 새 서버가 없습니다.");
        return;
      }
      const result = await importMutation.mutateAsync(
        importable.map((s) => s.name),
      );
      toast.success(`${result.length}개 MCP 서버 가져오기 완료`);
      setImportOpen(false);
    } catch (e) {
      toast.error(
        `가져오기 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}`,
      );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
          MCP SERVERS
        </Label>
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 font-mono text-2xs"
            onClick={handleOpenImport}
          >
            <Download className="h-3 w-3 mr-1" />
            가져오기
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 font-mono text-2xs"
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            추가
          </Button>
        </div>
      </div>
      <p className="font-mono text-2xs text-muted-foreground/70">
        Claude CLI에서 사용할 MCP 서버를 관리합니다. 세션 설정에서 사용할
        서버를 선택합니다.
      </p>

      <McpServerList
        servers={servers}
        onEdit={(server) => {
          setEditTarget(server);
          setFormOpen(true);
        }}
        onDelete={handleDelete}
        onToggleEnabled={handleToggleEnabled}
      />

      {/* 추가/수정 Dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm font-semibold">
              {editTarget ? "MCP 서버 수정" : "MCP 서버 추가"}
            </DialogTitle>
          </DialogHeader>
          <McpServerForm
            initial={editTarget}
            onSubmit={editTarget ? handleUpdate : handleCreate}
            onCancel={() => {
              setFormOpen(false);
              setEditTarget(null);
            }}
            isPending={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* 시스템 Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm font-semibold">
              시스템 MCP 서버 가져오기
            </DialogTitle>
          </DialogHeader>
          <p className="font-mono text-xs text-muted-foreground">
            ~/.claude/settings.json에서 MCP 서버를 가져옵니다.
          </p>
          {systemServers ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {systemServers.length === 0 ? (
                <p className="font-mono text-xs text-muted-foreground/60 text-center py-4">
                  시스템에 등록된 MCP 서버가 없습니다.
                </p>
              ) : (
                systemServers.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center gap-3 px-3 py-2 rounded-md bg-input/50 border border-border/50"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {s.name}
                      </span>
                      <span className="ml-2 font-mono text-2xs text-muted-foreground">
                        {s.transport_type}
                      </span>
                    </div>
                    {s.already_imported ? (
                      <span className="font-mono text-2xs text-success">
                        가져옴
                      </span>
                    ) : (
                      <span className="font-mono text-2xs text-warning">
                        새 항목
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <p className="font-mono text-xs text-muted-foreground/60 text-center py-4">
              로딩 중…
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1 font-mono text-xs font-semibold"
              onClick={handleImportAll}
              disabled={
                importMutation.isPending ||
                !systemServers?.some((s) => !s.already_imported)
              }
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {importMutation.isPending ? "가져오는 중…" : "전체 가져오기"}
            </Button>
            <Button
              variant="outline"
              className="font-mono text-xs"
              onClick={() => setImportOpen(false)}
            >
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
