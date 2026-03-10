import type { CreateDecisionCardInput, DecisionCard, SuggestionDisposition } from '../types/decision'
import type { DigestEntry } from '../types/knowledge'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createKnowledgeRepository } from '@/shared/lib/knowledgeDb'
import { extractSuggestionsFromSummary } from '../services/suggestionExtraction'
import { createDecisionCard } from '../types/decision'
import { decisionCardSchema } from '../types/knowledge'

const repository = createKnowledgeRepository()

export const useDecisionStore = defineStore('decision', () => {
  const cards = ref<DecisionCard[]>([])

  function upsertCard(card: DecisionCard) {
    const index = cards.value.findIndex(item => item.id === card.id)
    if (index >= 0)
      cards.value[index] = card
    else
      cards.value.unshift(card)

    cards.value.sort((left, right) => right.updatedAt - left.updatedAt)
  }

  function mergeSuggestions(current: DecisionCard['suggestions'], next: DecisionCard['suggestions']) {
    return next.map((suggestion) => {
      const existing = current.find(item => item.id === suggestion.id)
      if (!existing)
        return suggestion

      return {
        ...suggestion,
        disposition: existing.disposition,
        updatedAt: existing.updatedAt,
        updatedBy: existing.updatedBy,
      }
    })
  }

  async function materializeSuggestionsFromDigest(entry: DigestEntry) {
    const suggestions = extractSuggestionsFromSummary(entry)
    if (!suggestions.length)
      return null

    const existing = cards.value.find(card => card.id === `decision:digest:${entry.id}`)
    const baseCard = createDecisionCard({
      id: `decision:digest:${entry.id}`,
      conclusion: entry.title,
      context: entry.summary,
      owner: 'digest',
      status: 'open',
      citations: entry.citations,
      suggestions,
      now: existing?.createdAt ?? entry.createdAt,
    })

    const nextCard = decisionCardSchema.parse({
      ...baseCard,
      ...existing,
      conclusion: entry.title,
      context: entry.summary,
      owner: existing?.owner ?? 'digest',
      status: existing?.status ?? 'open',
      citations: entry.citations,
      citationEventIds: entry.citationEventIds,
      suggestions: mergeSuggestions(existing?.suggestions ?? [], baseCard.suggestions),
      createdAt: existing?.createdAt ?? baseCard.createdAt,
      updatedAt: Math.max(existing?.updatedAt ?? 0, entry.updatedAt, baseCard.updatedAt),
    })

    await repository.saveDecisionCard(nextCard)
    upsertCard(nextCard)
    return nextCard
  }

  async function hydrateCards() {
    const savedCards = await repository.listDecisionCards()
    cards.value = savedCards.map(card => decisionCardSchema.parse(card)).sort((left, right) => right.updatedAt - left.updatedAt)

    const digestEntries = await repository.listDigestEntries()
    // Only materialize suggestions from the most recent session
    const latestSessionId = digestEntries[0]?.sessionId
    const currentSessionEntries = latestSessionId
      ? digestEntries.filter(entry => entry.sessionId === latestSessionId)
      : []

    await Promise.all(currentSessionEntries.map(entry => materializeSuggestionsFromDigest(entry)))

    return cards.value
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
    hydrateCards,
    materializeSuggestionsFromDigest,
    setSuggestionDisposition,
  }
})
