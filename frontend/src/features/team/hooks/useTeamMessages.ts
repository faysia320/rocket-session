import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teamsApi } from "@/lib/api/teams.api";
import { teamKeys } from "./teamKeys";
import type { SendMessageRequest } from "@/types";

/**
 * 팀 메시지 CRUD 훅.
 */
export function useTeamMessages(teamId: string) {
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: teamKeys.messages(teamId),
    queryFn: () => teamsApi.listMessages(teamId, undefined, 100),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const sendMutation = useMutation({
    mutationFn: (data: SendMessageRequest) =>
      teamsApi.sendMessage(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.messages(teamId) });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (messageIds: number[]) =>
      teamsApi.markMessagesRead(teamId, messageIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.messages(teamId) });
    },
  });

  const invalidateMessages = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: teamKeys.messages(teamId) });
  }, [queryClient, teamId]);

  return {
    messages,
    isLoading,
    sendMessage: sendMutation.mutateAsync,
    isSending: sendMutation.isPending,
    markRead: markReadMutation.mutateAsync,
    invalidateMessages,
  };
}
