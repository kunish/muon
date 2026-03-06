import type { DigestEntry } from '@/features/chat/types/knowledge'
import type { DigestSession, DigestSourceEvent } from '@/features/chat/types/digest'
import { compareDigestEntries, toDigestEntry } from '@/features/chat/types/digest'

interface MaterializeOptions {
  sessionId: string
  windowStart: number
  windowEnd: number
}

export function materializeOfflineDigest(events: DigestSourceEvent[], options: MaterializeOptions): DigestSession {
  const entries: DigestEntry[] = events
    .filter(event => event.ts >= options.windowStart && event.ts <= options.windowEnd)
    .map(event => toDigestEntry(options.sessionId, event))
    .sort(compareDigestEntries)

  return {
    id: options.sessionId,
    entries,
    windowStart: options.windowStart,
    windowEnd: options.windowEnd,
    createdAt: options.windowEnd,
  }
}
