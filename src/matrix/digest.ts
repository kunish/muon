import type { DigestSession, DigestSourceEvent } from '@/features/chat/types/digest'
import type { DigestEntry } from '@/features/chat/types/knowledge'
import { compareDigestEntries, deriveDigestRelevance, toDigestEntry } from '@/features/chat/types/digest'
import { getClient } from './client'
import { getRoomSummaries } from './rooms'

interface MaterializeOptions {
  sessionId: string
  windowStart: number
  windowEnd: number
}

export function materializeOfflineDigest(events: DigestSourceEvent[], options: MaterializeOptions): DigestSession {
  const roomSignals = new Map(getRoomSummaries().map(summary => [summary.roomId, summary]))
  const currentUserId = getClient().getUserId?.() ?? null

  const entries: DigestEntry[] = events
    .filter(event => event.ts >= options.windowStart && event.ts <= options.windowEnd)
    .map((event) => {
      const relevance = deriveDigestRelevance(event, {
        roomSignal: roomSignals.get(event.roomId),
        currentUserId,
      })

      return toDigestEntry(options.sessionId, event, relevance)
    })
    .sort(compareDigestEntries)

  return {
    id: options.sessionId,
    entries,
    windowStart: options.windowStart,
    windowEnd: options.windowEnd,
    createdAt: options.windowEnd,
  }
}
