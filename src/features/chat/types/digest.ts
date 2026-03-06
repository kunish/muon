import type { CitationRef, DigestEntry, DigestRelevance } from './knowledge'
import { toCitationEventIds } from './knowledge'

export type DigestFilter = DigestRelevance | 'all'

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

export interface DigestSession {
  id: string
  entries: DigestEntry[]
  windowStart: number
  windowEnd: number
  createdAt: number
}

export const DIGEST_RELEVANCE_PRIORITY: Record<DigestRelevance, number> = {
  responsibility: 0,
  follow: 1,
  mention: 2,
}

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
