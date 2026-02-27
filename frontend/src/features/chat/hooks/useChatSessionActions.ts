/**
 * useChatSessionActions — 세션 관리 액션 (삭제, 아카이브, 워크트리, 포크)
 */
import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sessionsApi } from "@/lib/api/sessions.api";
import { filesystemApi } from "@/lib/api/filesystem.api";
import { useSessionStore } from "@/store";
import { useSessionMutations } from "@/features/session/hooks/useSessions";
import { sessionKeys } from "@/features/session/hooks/sessionKeys";

interface UseChatSessionActionsParams {
  sessionId: string;
  workDir?: string;
  worktreeName?: string | null;
  reconnect: () => void;
}

export function useChatSessionActions({
  sessionId,
  workDir,
  worktreeName,
  reconnect,
}: UseChatSessionActionsParams) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { deleteSession, archiveSession, unarchiveSession } = useSessionMutations();

  const handleDelete = useCallback(() => deleteSession(sessionId), [deleteSession, sessionId]);
  const handleArchive = useCallback(
    () => archiveSession(sessionId),
    [archiveSession, sessionId],
  );
  const handleUnarchive = useCallback(
    () => unarchiveSession(sessionId),
    [unarchiveSession, sessionId],
  );

  const handleRemoveWorktree = useCallback(async () => {
    if (!workDir || !worktreeName) return;
    try {
      await sessionsApi.delete(sessionId);
      await filesystemApi.removeWorktree(workDir, worktreeName, true);
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      toast.success("워크트리가 삭제되었습니다.");
      useSessionStore.getState().setViewMode("dashboard");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(`워크트리 삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [workDir, worktreeName, sessionId, queryClient, navigate]);

  const handleConvertToWorktree = useCallback(
    async (name: string) => {
      try {
        await sessionsApi.convertToWorktree(sessionId, { worktree_name: name });
        queryClient.invalidateQueries({ queryKey: sessionKeys.all });
        queryClient.invalidateQueries({ queryKey: ["git-info"] });
        toast.success(`워크트리로 전환되었습니다. (worktree-${name})`);
        reconnect();
      } catch (err) {
        toast.error(`워크트리 전환 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [sessionId, queryClient, reconnect],
  );

  const handleFork = useCallback(async () => {
    try {
      const forked = await sessionsApi.fork(sessionId);
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
      toast.success(
        "세션이 포크되었습니다. 이전 대화 기록은 참조용입니다. Claude는 새 대화로 시작합니다.",
      );
      navigate({ to: "/session/$sessionId", params: { sessionId: forked.id } });
    } catch {
      toast.error("세션 포크에 실패했습니다");
    }
  }, [sessionId, queryClient, navigate]);

  return {
    handleDelete,
    handleArchive,
    handleUnarchive,
    handleRemoveWorktree,
    handleConvertToWorktree,
    handleFork,
  };
}
