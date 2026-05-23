import { z } from 'zod'

// ---------------------------------------------------------------------------
// Feature-only types (not needed by the matrix layer)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Re-exports — canonical definitions now live in the matrix layer so that
// matrix/digest.ts does not have to depend on feature-level types.
// ---------------------------------------------------------------------------
// Import for local use within this module
import { citationRefSchema as _citationRefSchema } from '@/matrix/digestTypes'

export { citationRefSchema, DIGEST_RELEVANCE, digestEntrySchema, toCitationEventIds } from '@/matrix/digestTypes'

export type { CitationRef, DigestEntry, DigestRelevance } from '@/matrix/digestTypes'

export const KNOWLEDGE_TABS = ['digest', 'decision', 'qa'] as const

export const DECISION_STATUSES = ['open', 'confirmed', 'superseded'] as const

export const SUGGESTION_DISPOSITIONS = ['pending', 'accepted', 'rejected'] as const

export type KnowledgeTab = (typeof KNOWLEDGE_TABS)[number]
export type DecisionStatus = (typeof DECISION_STATUSES)[number]
export type SuggestionDisposition = (typeof SUGGESTION_DISPOSITIONS)[number]

export const decisionSuggestionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['action', 'blocker']),
  summary: z.string().min(1),
  disposition: z.enum(SUGGESTION_DISPOSITIONS).default('pending'),
  updatedAt: z.number().int().nonnegative(),
  updatedBy: z.string().min(1).optional(),
  citations: z.array(_citationRefSchema).min(1),
  citationEventIds: z.array(z.string().min(1)).min(1),
})

export type DecisionSuggestion = z.infer<typeof decisionSuggestionSchema>

export const decisionCardSchema = z.object({
  id: z.string().min(1),
  conclusion: z.string().min(1),
  context: z.string().min(1),
  owner: z.string().min(1),
  status: z.enum(DECISION_STATUSES),
  citations: z.array(_citationRefSchema).min(1),
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
  citations: z.array(_citationRefSchema).min(1),
  citationEventIds: z.array(z.string().min(1)).min(1),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export type CrossSessionQaAnswer = z.infer<typeof crossSessionQaAnswerSchema>
