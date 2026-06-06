import type { DigestSourceEvent } from '../types/digest'
import type { DigestEntry } from '../types/knowledge'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { buildDigestSession, loadDigestEntries } from './digestApi'
import { digestKeys } from './digestKeys'

export function useDigestEntriesQuery() {
  const query = useQuery({
    queryKey: digestKeys.entries(),
    queryFn: loadDigestEntries,
    // Driven manually from the panel's onMounted (await refetch) so the away-window
    // session build runs strictly AFTER hydration. An auto-fetch would race the
    // build mutation's setQueryData and could clobber a freshly materialized session.
    enabled: false,
  })
  const entries = computed(() => query.data.value ?? [])
  // Spread the full query so callers can reach refetch/isError; `entries` is a
  // convenience computed so call sites avoid `data.value ?? []`.
  return { ...query, entries }
}

export interface BuildDigestSessionInput {
  sourceEvents: DigestSourceEvent[]
  windowStart: number
  windowEnd: number
}

export function useBuildDigestSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sourceEvents, windowStart, windowEnd }: BuildDigestSessionInput) =>
      buildDigestSession(sourceEvents, { windowStart, windowEnd }),
    onSuccess: (entries) => {
      // Empty materialization preserves the hydrated cache (don't overwrite with []);
      // a non-empty session becomes the new authoritative entries list.
      if (entries.length > 0) {
        queryClient.setQueryData<DigestEntry[]>(digestKeys.entries(), entries)
      }
    },
  })
}
