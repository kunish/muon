import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createKnowledgeRepository } from '@/shared/lib/knowledgeDb'
import { decisionCardSchema } from '../types/knowledge'
import type { CreateDecisionCardInput, DecisionCard, SuggestionDisposition } from '../types/decision'
import { createDecisionCard } from '../types/decision'

const repository = createKnowledgeRepository()

export const useDecisionStore = defineStore('decision', () => {
  const cards = ref<DecisionCard[]>([])

  function upsertCard(card: DecisionCard) {
    const index = cards.value.findIndex(item => item.id === card.id)
    if (index >= 0)
      cards.value[index] = card
    else
      cards.value.unshift(card)
  }

  async function createDecisionCardAction(input: CreateDecisionCardInput) {
    const card = decisionCardSchema.parse(createDecisionCard(input))
    await repository.saveDecisionCard(card)
    upsertCard(card)
    return card
  }

  async function setSuggestionDisposition(decisionId: string, suggestionId: string, disposition: Exclude<SuggestionDisposition, 'pending'>, updatedBy = 'local-user', updatedAt = Date.now()) {
    if (disposition !== 'accepted' && disposition !== 'rejected')
      throw new Error('Invalid suggestion disposition')

    const current = cards.value.find(card => card.id === decisionId)
    if (!current)
      throw new Error(`Decision ${decisionId} not found`)

    const updated = await repository.updateSuggestionDisposition(decisionId, suggestionId, disposition, updatedBy, updatedAt)
    const updatedSuggestions = (updated as Partial<DecisionCard>).suggestions
      ? current.suggestions.map((suggestion) => {
          const patch = (updated as Partial<DecisionCard>).suggestions?.find(item => item.id === suggestion.id)
          return patch ? { ...suggestion, ...patch } : suggestion
        })
      : current.suggestions

    const nextCard = decisionCardSchema.parse({
      ...current,
      ...updated,
      updatedAt: (updated as DecisionCard).updatedAt ?? updatedAt,
      suggestions: updatedSuggestions,
    })

    upsertCard(nextCard)
    return nextCard
  }

  return {
    cards,
    createDecisionCard: createDecisionCardAction,
    setSuggestionDisposition,
  }
})
