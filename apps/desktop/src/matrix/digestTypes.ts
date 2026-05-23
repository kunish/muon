import { z } from 'zod'

// ============================================================================
// Digest relevance & classification
// ============================================================================

export const DIGEST_RELEVANCE = ['responsibility', 'follow', 'mention'] as const
export type DigestRelevance = typeof DIGEST_RELEVANCE[number]

export type DigestFilter = DigestRelevance | 'all'

export const DIGEST_RELEVANCE_PRIORITY: Record<DigestRelevance, number> = {
  responsibility: 0,
  follow: 1,
  mention: 2,
}

// ============================================================================
// Citation / reference types
// ============================================================================

export const citationRefSchema = z.object({
  roomId: z.string().min(1),
  eventId: z.string().min(1),
  quote: z.string().min(1).optional(),
})

export type CitationRef = z.infer<typeof citationRefSchema>

export function toCitationEventIds(citations: CitationRef[]): string[] {
  return citations.map(citation => citation.eventId)
}

// ============================================================================
// Digest entry types
// ============================================================================

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

// ============================================================================
// Digest source event types
// ============================================================================

export interface DigestRoomSignal {
  roomId: string
  isPinned?: boolean
  highlightCount?: number
}

export interface DigestSourceEvent {
  roomId: string
  eventId: string
  sender: string
  body: string
  ts: number
  relevanceHint?: DigestRelevance
}

// ============================================================================
// Digest session types
// ============================================================================

export interface DigestSession {
  id: string
  entries: DigestEntry[]
  windowStart: number
  windowEnd: number
  createdAt: number
}

// ============================================================================
// Pure utility functions (no side effects, no Matrix SDK deps)
// ============================================================================

export function createDigestCitation(roomId: string, eventId: string, body: string): CitationRef {
  return {
    roomId,
    eventId,
    quote: body,
  }
}

function createMentionTokens(userId?: string | null): string[] {
  if (!userId)
    return []

  const localpart = userId.split(':')[0]
  return [userId, localpart].filter(Boolean)
}

export function deriveDigestRelevance(
  event: DigestSourceEvent,
  options: {
    roomSignal?: DigestRoomSignal
    currentUserId?: string | null
  } = {},
): DigestRelevance {
  const mentionTokens = createMentionTokens(options.currentUserId)
  const mentionsCurrentUser = mentionTokens.some(token => event.body.includes(token))

  if ((options.roomSignal?.highlightCount ?? 0) > 0 || mentionsCurrentUser)
    return 'responsibility'

  if (options.roomSignal?.isPinned)
    return 'follow'

  return event.relevanceHint ?? 'mention'
}

export function toDigestEntry(sessionId: string, event: DigestSourceEvent, relevance?: DigestRelevance): DigestEntry {
  const citation = createDigestCitation(event.roomId, event.eventId, event.body)
  return {
    id: `digest:${event.eventId}`,
    sessionId,
    title: event.body.slice(0, 60) || event.eventId,
    summary: event.body,
    relevance: relevance ?? event.relevanceHint ?? 'mention',
    citations: [citation],
    citationEventIds: toCitationEventIds([citation]),
    createdAt: event.ts,
    updatedAt: event.ts,
  }
}

export function compareDigestEntries(a: DigestEntry, b: DigestEntry): number {
  const priorityDiff = DIGEST_RELEVANCE_PRIORITY[a.relevance] - DIGEST_RELEVANCE_PRIORITY[b.relevance]
  if (priorityDiff !== 0)
    return priorityDiff

  return b.createdAt - a.createdAt
}
