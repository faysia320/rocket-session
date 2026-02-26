/**
 * Optimistic update 패턴을 캡슐화하는 useMutation 래퍼.
 *
 * onMutate(cancelQueries → snapshot → setQueryData) + onError(rollback) + onSettled(invalidate) 보일러플레이트 제거.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

interface UseOptimisticMutationOptions<TCacheData, TVariables, TResult = unknown> {
  mutationFn: (variables: TVariables) => Promise<TResult>;
  /** 캐시 읽기/쓰기 대상 쿼리 키 */
  queryKey: QueryKey;
  /** 현재 캐시 데이터 + 변수를 받아 새 캐시 데이터를 반환 */
  updater: (old: TCacheData | undefined, variables: TVariables) => TCacheData;
  /** 에러 시 토스트 메시지 */
  errorMessage: string;
  /** onSettled에서 invalidate할 쿼리 키 (기본값: queryKey) */
  invalidateKey?: QueryKey;
  /** 기본 onSettled 후 추가로 호출할 콜백 */
  onSettledExtra?: () => void;
}

export function useOptimisticMutation<TCacheData, TVariables, TResult = unknown>({
  mutationFn,
  queryKey,
  updater,
  errorMessage,
  invalidateKey,
  onSettledExtra,
}: UseOptimisticMutationOptions<TCacheData, TVariables, TResult>) {
  const queryClient = useQueryClient();

  return useMutation<TResult, Error, TVariables, { previous: TCacheData | undefined }>({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TCacheData>(queryKey);
      queryClient.setQueryData<TCacheData>(queryKey, (old) => updater(old, variables));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error(errorMessage);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey ?? queryKey });
      onSettledExtra?.();
    },
  });
}
