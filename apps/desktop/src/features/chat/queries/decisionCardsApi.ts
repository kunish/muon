import type { CreateDecisionCardInput, DecisionCard, SuggestionDisposition } from '../types/decision'
import type { DigestEntry } from '../types/knowledge'
import { createKnowledgeRepository } from '@features/chat/lib/knowledgeDb'
import { extractSuggestionsFromSummary } from '../services/suggestionExtraction'
import { createDecisionCard } from '../types/decision'
import { decisionCardSchema } from '../types/knowledge'

const repository = createKnowledgeRepository()

function byUpdatedAtDesc(left: DecisionCard, right: DecisionCard) {
  return right.updatedAt - left.updatedAt
}

export function upsertDecisionCard(cards: DecisionCard[], card: DecisionCard): DecisionCard[] {
  return [...cards.filter((item) => item.id !== card.id), card].sort(byUpdatedAtDesc)
}

function mergeSuggestions(
  current: DecisionCard['suggestions'],
  next: DecisionCard['suggestions'],
): DecisionCard['suggestions'] {
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

async function materializeSuggestionsFromDigest(
  entry: DigestEntry,
  existing: DecisionCard | undefined,
): Promise<DecisionCard | null> {
  const suggestions = extractSuggestionsFromSummary(entry)
  if (!suggestions.length) return null

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
  return nextCard
}

export async function loadDecisionCards(): Promise<DecisionCard[]> {
  const savedCards = (await repository.listDecisionCards())
    .map((card) => decisionCardSchema.parse(card))
    .sort(byUpdatedAtDesc)

  const cardsById = new Map(savedCards.map((card) => [card.id, card]))

  const digestEntries = await repository.listDigestEntries()
  // Only materialize suggestions from the most recent session.
  // listDigestEntries returns entries ordered by createdAt DESC, so [0] is the most recent.
  const latestSessionId = digestEntries[0]?.sessionId
  const currentSessionEntries = latestSessionId
    ? digestEntries.filter((entry) => entry.sessionId === latestSessionId)
    : []

  const materialized = await Promise.all(
    currentSessionEntries.map((entry) =>
      materializeSuggestionsFromDigest(entry, cardsById.get(`decision:digest:${entry.id}`)),
    ),
  )

  for (const card of materialized) {
    if (card) cardsById.set(card.id, card)
  }

  return [...cardsById.values()].sort(byUpdatedAtDesc)
}

export async function createDecisionCardEntry(input: CreateDecisionCardInput): Promise<DecisionCard> {
  const card = decisionCardSchema.parse(createDecisionCard(input))
  await repository.saveDecisionCard(card)
  return card
}

export async function setSuggestionDispositionEntry(
  current: DecisionCard,
  suggestionId: string,
  disposition: Exclude<SuggestionDisposition, 'pending'>,
  updatedBy = 'local-user',
  updatedAt = Date.now(),
): Promise<DecisionCard> {
  if (disposition !== 'accepted' && disposition !== 'rejected') {
    throw new Error('Invalid suggestion disposition')
  }

  const updated = await repository.updateSuggestionDisposition(
    current.id,
    suggestionId,
    disposition,
    updatedBy,
    updatedAt,
  )

  const updatedSuggestions = (updated as Partial<DecisionCard>).suggestions
    ? current.suggestions.map((suggestion) => {
        const patch = (updated as Partial<DecisionCard>).suggestions?.find((item) => item.id === suggestion.id)
        return patch ? { ...suggestion, ...patch } : suggestion
      })
    : current.suggestions

  return decisionCardSchema.parse({
    ...current,
    ...updated,
    updatedAt: (updated as DecisionCard).updatedAt ?? updatedAt,
    suggestions: updatedSuggestions,
  })
}
