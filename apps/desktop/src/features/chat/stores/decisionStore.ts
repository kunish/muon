import type { CreateDecisionCardInput, DecisionCard, SuggestionDisposition } from '../types/decision'
import type { DigestEntry } from '../types/knowledge'
import type { DesktopEffect } from '@/shared/lib/effect'
import { createKnowledgeRepository } from '@features/chat/lib/knowledgeDb'
import { Effect } from 'effect'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { extractSuggestionsFromSummary } from '../services/suggestionExtraction'
import { createDecisionCard } from '../types/decision'
import { decisionCardSchema } from '../types/knowledge'

const repository = createKnowledgeRepository()

export const useDecisionStore = defineStore('decision', () => {
  const cards = ref<DecisionCard[]>([])

  function upsertCard(card: DecisionCard) {
    const index = cards.value.findIndex((item) => item.id === card.id)
    if (index >= 0) cards.value[index] = card
    else cards.value.unshift(card)

    cards.value.sort((left, right) => right.updatedAt - left.updatedAt)
  }

  function mergeSuggestions(current: DecisionCard['suggestions'], next: DecisionCard['suggestions']) {
    return next.map((suggestion) => {
      const existing = current.find((item) => item.id === suggestion.id)
      if (!existing) return suggestion

      return {
        ...suggestion,
        disposition: existing.disposition,
        updatedAt: existing.updatedAt,
        updatedBy: existing.updatedBy,
      }
    })
  }

  function materializeSuggestionsFromDigestEffect(entry: DigestEntry): DesktopEffect<DecisionCard | null> {
    return Effect.gen(function* () {
      const suggestions = extractSuggestionsFromSummary(entry)
      if (!suggestions.length) return null

      const existing = cards.value.find((card) => card.id === `decision:digest:${entry.id}`)
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

      yield* fromPromise(() => repository.saveDecisionCard(nextCard))
      yield* fromSync(() => upsertCard(nextCard))
      return nextCard
    })
  }

  function materializeSuggestionsFromDigest(entry: DigestEntry) {
    return runDesktopEffect(materializeSuggestionsFromDigestEffect(entry))
  }

  function hydrateCardsEffect(): DesktopEffect<DecisionCard[]> {
    return Effect.gen(function* () {
      const savedCards = yield* fromPromise(() => repository.listDecisionCards())
      cards.value = savedCards
        .map((card) => decisionCardSchema.parse(card))
        .sort((left, right) => right.updatedAt - left.updatedAt)

      const digestEntries = yield* fromPromise(() => repository.listDigestEntries())
      // Only materialize suggestions from the most recent session
      const latestSessionId = digestEntries[0]?.sessionId
      const currentSessionEntries = latestSessionId
        ? digestEntries.filter((entry) => entry.sessionId === latestSessionId)
        : []

      yield* Effect.all(
        currentSessionEntries.map((entry) => materializeSuggestionsFromDigestEffect(entry)),
        {
          concurrency: 'unbounded',
        },
      )

      return cards.value
    })
  }

  function hydrateCards() {
    return runDesktopEffect(hydrateCardsEffect())
  }

  function createDecisionCardActionEffect(input: CreateDecisionCardInput): DesktopEffect<DecisionCard> {
    return Effect.gen(function* () {
      const card = decisionCardSchema.parse(createDecisionCard(input))
      yield* fromPromise(() => repository.saveDecisionCard(card))
      yield* fromSync(() => upsertCard(card))
      return card
    })
  }

  function createDecisionCardAction(input: CreateDecisionCardInput) {
    return runDesktopEffect(createDecisionCardActionEffect(input))
  }

  function setSuggestionDispositionEffect(
    decisionId: string,
    suggestionId: string,
    disposition: Exclude<SuggestionDisposition, 'pending'>,
    updatedBy = 'local-user',
    updatedAt = Date.now(),
  ): DesktopEffect<DecisionCard> {
    return Effect.gen(function* () {
      if (disposition !== 'accepted' && disposition !== 'rejected') {
        return yield* fromSync(() => {
          throw new Error('Invalid suggestion disposition')
        })
      }

      const current = cards.value.find((card) => card.id === decisionId)
      if (!current) {
        return yield* fromSync(() => {
          throw new Error(`Decision ${decisionId} not found`)
        })
      }

      const updated = yield* fromPromise(() =>
        repository.updateSuggestionDisposition(decisionId, suggestionId, disposition, updatedBy, updatedAt),
      )
      const updatedSuggestions = (updated as Partial<DecisionCard>).suggestions
        ? current.suggestions.map((suggestion) => {
            const patch = (updated as Partial<DecisionCard>).suggestions?.find((item) => item.id === suggestion.id)
            return patch ? { ...suggestion, ...patch } : suggestion
          })
        : current.suggestions

      const nextCard = decisionCardSchema.parse({
        ...current,
        ...updated,
        updatedAt: (updated as DecisionCard).updatedAt ?? updatedAt,
        suggestions: updatedSuggestions,
      })

      yield* fromSync(() => upsertCard(nextCard))
      return nextCard
    })
  }

  function setSuggestionDisposition(
    decisionId: string,
    suggestionId: string,
    disposition: Exclude<SuggestionDisposition, 'pending'>,
    updatedBy = 'local-user',
    updatedAt = Date.now(),
  ) {
    return runDesktopEffect(setSuggestionDispositionEffect(decisionId, suggestionId, disposition, updatedBy, updatedAt))
  }

  return {
    cards,
    createDecisionCardEffect: createDecisionCardActionEffect,
    hydrateCardsEffect,
    materializeSuggestionsFromDigestEffect,
    setSuggestionDispositionEffect,
    createDecisionCard: createDecisionCardAction,
    hydrateCards,
    materializeSuggestionsFromDigest,
    setSuggestionDisposition,
  }
})
