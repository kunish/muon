import { z } from 'zod'

export const KNOWLEDGE_TABS = ['digest', 'decision', 'qa'] as const

export const DIGEST_RELEVANCE = ['responsibility', 'follow', 'mention'] as const

export const DECISION_STATUSES = ['open', 'confirmed', 'superseded'] as const

export const SUGGESTION_DISPOSITIONS = ['pending', 'accepted', 'rejected'] as const

export type KnowledgeTab = typeof KNOWLEDGE_TABS[number]
export type DigestRelevance = typeof DIGEST_RELEVANCE[number]
export type DecisionStatus = typeof DECISION_STATUSES[number]
export type SuggestionDisposition = typeof SUGGESTION_DISPOSITIONS[number]

export const citationRefSchema = z.object({
  roomId: z.string().min(1),
  eventId: z.string().min(1),
  quote: z.string().min(1).optional(),
})

export type CitationRef = z.infer<typeof citationRefSchema>

export const digestEntrySchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  relevance: z.enum(DIGEST_RELEVANCE),
  citations: z.array(citationRefSchema).min(1),
  citationEventIds: z.array(z.string().min(1)).min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export type DigestEntry = z.infer<typeof digestEntrySchema>

export const decisionSuggestionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['action', 'blocker']),
  summary: z.string().min(1),
  disposition: z.enum(SUGGESTION_DISPOSITIONS).default('pending'),
  updatedAt: z.number().int().nonnegative(),
  updatedBy: z.string().min(1).optional(),
  citations: z.array(citationRefSchema).min(1),
  citationEventIds: z.array(z.string().min(1)).min(1),
})

export type DecisionSuggestion = z.infer<typeof decisionSuggestionSchema>

export const decisionCardSchema = z.object({
  id: z.string().min(1),
  conclusion: z.string().min(1),
  context: z.string().min(1),
  owner: z.string().min(1),
  status: z.enum(DECISION_STATUSES),
  citations: z.array(citationRefSchema).min(1),
  citationEventIds: z.array(z.string().min(1)).min(1),
  suggestions: z.array(decisionSuggestionSchema).default([]),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export type DecisionCard = z.infer<typeof decisionCardSchema>

export const crossSessionQaAnswerSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  citations: z.array(citationRefSchema).min(1),
  citationEventIds: z.array(z.string().min(1)).min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export type CrossSessionQaAnswer = z.infer<typeof crossSessionQaAnswerSchema>

export function toCitationEventIds(citations: CitationRef[]): string[] {
  return citations.map(citation => citation.eventId)
}
