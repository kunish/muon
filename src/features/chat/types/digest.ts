import type { CitationRef, DigestEntry, DigestRelevance } from './knowledge'
import { toCitationEventIds } from './knowledge'

export type DigestFilter = DigestRelevance | 'all'

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

export function toDigestEntry(sessionId: string, event: DigestSourceEvent): DigestEntry {
  const citation = createDigestCitation(event.roomId, event.eventId, event.body)
  return {
    id: `digest:${event.eventId}`,
    sessionId,
    title: event.body.slice(0, 60) || event.eventId,
    summary: event.body,
    relevance: event.relevanceHint ?? 'mention',
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
