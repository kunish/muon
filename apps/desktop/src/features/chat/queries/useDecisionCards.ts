import type { DecisionCard, SuggestionDisposition } from '../types/decision'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import {
  createDecisionCardEntry,
  loadDecisionCards,
  setSuggestionDispositionEntry,
  upsertDecisionCard,
} from './decisionCardsApi'
import { decisionKeys } from './decisionKeys'

export function useDecisionCardsQuery() {
  const query = useQuery({
    queryKey: decisionKeys.cards(),
    queryFn: loadDecisionCards,
  })
  const cards = computed(() => query.data.value ?? [])
  // Spread the full query so callers can reach isLoading/isError/refetch; `cards`
  // is a convenience computed so call sites avoid `data.value ?? []` everywhere.
  return { ...query, cards }
}

export function useCreateDecisionCard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createDecisionCardEntry,
    onSuccess: (card) => {
      queryClient.setQueryData<DecisionCard[]>(decisionKeys.cards(), (prev) => upsertDecisionCard(prev ?? [], card))
    },
  })
}

export interface SetSuggestionDispositionVariables {
  decisionId: string
  suggestionId: string
  disposition: Exclude<SuggestionDisposition, 'pending'>
  updatedBy?: string
  updatedAt?: number
}

export function useSetSuggestionDisposition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      decisionId,
      suggestionId,
      disposition,
      updatedBy,
      updatedAt,
    }: SetSuggestionDispositionVariables) => {
      const cards = queryClient.getQueryData<DecisionCard[]>(decisionKeys.cards()) ?? []
      const current = cards.find((card) => card.id === decisionId)
      if (!current) throw new Error(`Decision ${decisionId} not found`)
      return setSuggestionDispositionEntry(current, suggestionId, disposition, updatedBy, updatedAt)
    },
    onSuccess: (card) => {
      queryClient.setQueryData<DecisionCard[]>(decisionKeys.cards(), (prev) => upsertDecisionCard(prev ?? [], card))
    },
  })
}
