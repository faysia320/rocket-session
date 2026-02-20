import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { settingsApi } from "@/lib/api/settings.api";
import type { GlobalSettings, UpdateGlobalSettingsRequest } from "@/types";

/** 글로벌 설정 쿼리 키 팩토리 */
export const settingsKeys = {
  all: ["settings"] as const,
  global: () => [...settingsKeys.all, "global"] as const,
};

/** 글로벌 설정 조회 훅 */
export function useGlobalSettings() {
  return useQuery({
    queryKey: settingsKeys.global(),
    queryFn: () => settingsApi.get(),
    staleTime: 5 * 60 * 1000,
  });
}

/** 글로벌 설정 업데이트 뮤테이션 훅 */
export function useUpdateGlobalSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateGlobalSettingsRequest) => settingsApi.update(data),
    onSuccess: (data: GlobalSettings) => {
      queryClient.setQueryData(settingsKeys.global(), data);
    },
    onError: (err) => {
      toast.error(`설정 저장에 실패했습니다: ${err instanceof Error ? err.message : String(err)}`);
    },
  });
}
