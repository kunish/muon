import type { CrossSessionQaAnswer } from '../types/knowledge'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { askQuestionEntry, loadQaHistory, upsertQaAnswer } from './qaApi'
import { qaKeys } from './qaKeys'

export function useQaHistoryQuery() {
  const query = useQuery({
    queryKey: qaKeys.history(),
    queryFn: loadQaHistory,
  })
  const history = computed(() => query.data.value ?? [])
  // Spread the full query so callers can reach isLoading/isError/refetch; `history`
  // is a convenience computed so call sites avoid `data.value ?? []` everywhere.
  return { ...query, history }
}

export function useAskQuestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: askQuestionEntry,
    onSuccess: (answer) => {
      queryClient.setQueryData<CrossSessionQaAnswer[]>(qaKeys.history(), (prev) => upsertQaAnswer(prev ?? [], answer))
    },
  })
}
