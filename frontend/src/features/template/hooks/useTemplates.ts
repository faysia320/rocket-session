import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { templatesApi } from "@/lib/api/templates.api";
import { templateKeys } from "./templateKeys";
import type {
  CreateTemplateRequest,
  UpdateTemplateRequest,
  CreateTemplateFromSessionRequest,
  TemplateExport,
} from "@/types";

/** 템플릿 목록 조회 */
export function useTemplates() {
  return useQuery({
    queryKey: templateKeys.list(),
    queryFn: () => templatesApi.list(),
    staleTime: 5 * 60 * 1000,
  });
}

/** 템플릿 생성 */
export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTemplateRequest) => templatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
      toast.success("템플릿이 생성되었습니다");
    },
    onError: (err) => {
      toast.error(
        `템플릿 생성 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    },
  });
}

/** 템플릿 수정 */
export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTemplateRequest }) =>
      templatesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
      toast.success("템플릿이 수정되었습니다");
    },
    onError: (err) => {
      toast.error(
        `템플릿 수정 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    },
  });
}

/** 템플릿 삭제 */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
      toast.success("템플릿이 삭제되었습니다");
    },
    onError: (err) => {
      toast.error(
        `템플릿 삭제 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    },
  });
}

/** 세션에서 템플릿 생성 */
export function useCreateTemplateFromSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      data,
    }: {
      sessionId: string;
      data: CreateTemplateFromSessionRequest;
    }) => templatesApi.createFromSession(sessionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
      toast.success("세션 설정이 템플릿으로 저장되었습니다");
    },
    onError: (err) => {
      toast.error(
        `템플릿 저장 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    },
  });
}

/** 템플릿 import */
export function useImportTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TemplateExport) => templatesApi.import(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
      toast.success("템플릿을 불러왔습니다");
    },
    onError: (err) => {
      toast.error(
        `템플릿 불러오기 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    },
  });
}
