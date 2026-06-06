import type { DigestFilter, DigestSession, DigestSourceEvent } from '../types/digest'
import type { DigestEntry } from '../types/knowledge'
import { createKnowledgeRepository } from '@features/chat/lib/knowledgeDb'
import { materializeOfflineDigest } from '@/matrix/digest'
import { compareDigestEntries } from '../types/digest'

const repository = createKnowledgeRepository()

export interface DigestWindow {
  windowStart: number
  windowEnd: number
}

/** A digest entry decorated with the eventId the panel keys its citation rows on. */
export type VisibleDigestEntry = DigestEntry & { eventId: string }

function sortDigestEntries(entries: DigestEntry[]): DigestEntry[] {
  return [...entries].sort(compareDigestEntries)
}

export async function loadDigestEntries(): Promise<DigestEntry[]> {
  return sortDigestEntries(await repository.listDigestEntries())
}

/** Filter (or pass through 'all'), sort by relevance>recency, and surface a stable eventId for rendering. */
export function selectVisibleDigestEntries(entries: DigestEntry[], filter: DigestFilter): VisibleDigestEntry[] {
  const filtered = filter === 'all' ? entries : entries.filter((entry) => entry.relevance === filter)
  return sortDigestEntries(filtered).map((entry) => ({
    ...entry,
    eventId: entry.citations[0]?.eventId ?? entry.id,
  }))
}

export function materializeDigestSession(events: DigestSourceEvent[], window: DigestWindow): DigestSession {
  return materializeOfflineDigest(events, {
    sessionId: `digest-session:${window.windowStart}:${window.windowEnd}`,
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
  })
}

async function persistDigestEntries(entries: DigestEntry[]): Promise<void> {
  await Promise.all(entries.map((entry) => repository.saveDigestEntry(entry)))
}

/**
 * Materialize the away-window session from accumulated source events. Persists and
 * returns the entries only when materialization is non-empty; an empty result returns
 * `[]` and writes nothing, so callers preserve any already-hydrated entries (the old
 * store's merge-on-empty rule, without needing to read the prior list).
 */
export async function buildDigestSession(events: DigestSourceEvent[], window: DigestWindow): Promise<DigestEntry[]> {
  const session = materializeDigestSession(events, window)
  if (session.entries.length > 0) {
    await persistDigestEntries(session.entries)
  }
  return session.entries
}
