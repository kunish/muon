import type {
  CitationRef,
  DecisionCard,
  DecisionStatus,
  DecisionSuggestion,
  SuggestionDisposition,
} from './knowledge'
import { toCitationEventIds } from './knowledge'

export type { DecisionCard, DecisionStatus, DecisionSuggestion, SuggestionDisposition }

export interface CreateDecisionSuggestionInput {
  id: string
  kind: 'action' | 'blocker'
  summary: string
  citations: CitationRef[]
}

export interface CreateDecisionCardInput {
  id: string
  conclusion: string
  context: string
  owner: string
  status: DecisionStatus
  citations: CitationRef[]
  suggestions?: CreateDecisionSuggestionInput[]
  now?: number
}

export function createDecisionSuggestion(input: CreateDecisionSuggestionInput, now: number): DecisionSuggestion {
  return {
    id: input.id,
    kind: input.kind,
    summary: input.summary,
    disposition: 'pending',
    updatedAt: now,
    citations: input.citations,
    citationEventIds: toCitationEventIds(input.citations),
  }
}

export function createDecisionCard(input: CreateDecisionCardInput): DecisionCard {
  const now = input.now ?? Date.now()
  return {
    id: input.id,
    conclusion: input.conclusion,
    context: input.context,
    owner: input.owner,
    status: input.status,
    citations: input.citations,
    citationEventIds: toCitationEventIds(input.citations),
    suggestions: (input.suggestions ?? []).map(suggestion => createDecisionSuggestion(suggestion, now)),
    createdAt: now,
    updatedAt: now,
  }
}
