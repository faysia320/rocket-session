import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { teamsApi } from "@/lib/api/teams.api";
import { teamKeys } from "./teamKeys";
import type {
  TeamListItem,
  CreateTeamRequest,
  UpdateTeamRequest,
  AddTeamMemberRequest,
  SetLeadRequest,
} from "@/types";

/**
 * 팀 목록 + CRUD 훅.
 */
export function useTeams(status?: string) {
  const queryClient = useQueryClient();

  const {
    data: teams = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: teamKeys.list(status),
    queryFn: () => teamsApi.list(status),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const refreshTeams = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: teamKeys.all });
  }, [queryClient]);

  return { teams, isLoading, isError, refreshTeams };
}

/**
 * 팀 상세 조회 훅.
 */
export function useTeamDetail(teamId: string | undefined) {
  return useQuery({
    queryKey: teamKeys.detail(teamId ?? ""),
    queryFn: () => teamsApi.get(teamId!),
    enabled: !!teamId,
    staleTime: 5_000,
  });
}

/**
 * 팀 생성 훅.
 */
export function useCreateTeam() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateTeamRequest) => teamsApi.create(data),
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
      toast.success(`팀 "${team.name}"이 생성되었습니다`);
      navigate({ to: "/team/$teamId", params: { teamId: team.id } });
    },
    onError: (err: Error) => {
      toast.error(`팀 생성 실패: ${err.message}`);
    },
  });

  return mutation;
}

/**
 * 팀 수정 훅.
 */
export function useUpdateTeam(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTeamRequest) => teamsApi.update(teamId, data),
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
      toast.success(`팀 "${team.name}"이 수정되었습니다`);
    },
    onError: (err: Error) => {
      toast.error(`팀 수정 실패: ${err.message}`);
    },
  });
}

/**
 * 팀 삭제 훅.
 */
export function useDeleteTeam() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => teamsApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: teamKeys.list() });
      const previous = queryClient.getQueryData<TeamListItem[]>(teamKeys.list());
      queryClient.setQueryData<TeamListItem[]>(
        teamKeys.list(),
        (old) => old?.filter((t) => t.id !== id) ?? [],
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(teamKeys.list(), context.previous);
      }
      toast.error("팀 삭제에 실패했습니다");
    },
    onSuccess: () => {
      navigate({ to: "/" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.all });
    },
  });
}

/**
 * 팀 멤버 관리 훅.
 */
export function useTeamMembers(teamId: string) {
  const queryClient = useQueryClient();

  const addMemberMutation = useMutation({
    mutationFn: (data: AddTeamMemberRequest) => teamsApi.addMember(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.detail(teamId) });
      queryClient.invalidateQueries({ queryKey: teamKeys.members(teamId) });
      queryClient.invalidateQueries({ queryKey: teamKeys.list() });
      toast.success("멤버가 추가되었습니다");
    },
    onError: (err: Error) => {
      toast.error(`멤버 추가 실패: ${err.message}`);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: number) => teamsApi.removeMember(teamId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.detail(teamId) });
      queryClient.invalidateQueries({ queryKey: teamKeys.list() });
      toast.success("멤버가 제거되었습니다");
    },
    onError: () => {
      toast.error("멤버 제거에 실패했습니다");
    },
  });

  const setLeadMutation = useMutation({
    mutationFn: (data: SetLeadRequest) => teamsApi.setLead(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.detail(teamId) });
      queryClient.invalidateQueries({ queryKey: teamKeys.list() });
      toast.success("리드가 변경되었습니다");
    },
    onError: (err: Error) => {
      toast.error(`리드 변경 실패: ${err.message}`);
    },
  });

  return {
    addMember: addMemberMutation.mutateAsync,
    removeMember: removeMemberMutation.mutateAsync,
    setLead: setLeadMutation.mutateAsync,
    isAddingMember: addMemberMutation.isPending,
  };
}
