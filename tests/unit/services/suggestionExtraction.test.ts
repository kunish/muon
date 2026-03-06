import { describe, expect, it } from 'vitest'
import type { DigestEntry } from '@/features/chat/types/knowledge'

function createDigestEntry(overrides: Partial<DigestEntry> = {}): DigestEntry {
  return {
    id: 'digest-1',
    sessionId: 'digest-session-1',
    title: 'Digest recap',
    summary: 'Action: Follow up with Alice on rollout readiness. Blocker: Waiting on security review approval.',
    relevance: 'responsibility',
    citations: [{ roomId: '!room:muon.dev', eventId: '$event-1', quote: 'Need follow-up before launch' }],
    citationEventIds: ['$event-1'],
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  }
}

describe('suggestionExtraction', () => {
  it('extracts pending suggestions from digest summaries with stable ids and preserved citations', async () => {
    const { extractSuggestionsFromSummary } = await import('@/features/chat/services/suggestionExtraction')

    const suggestions = extractSuggestionsFromSummary(createDigestEntry())

    expect(suggestions).toEqual([
      {
        id: 'digest-1:action:0',
        kind: 'action',
        summary: 'Follow up with Alice on rollout readiness.',
        citations: [{ roomId: '!room:muon.dev', eventId: '$event-1', quote: 'Need follow-up before launch' }],
      },
      {
        id: 'digest-1:blocker:0',
        kind: 'blocker',
        summary: 'Waiting on security review approval.',
        citations: [{ roomId: '!room:muon.dev', eventId: '$event-1', quote: 'Need follow-up before launch' }],
      },
    ])
  })

  it('returns an empty array when digest summary has no action or blocker signal', async () => {
    const { extractSuggestionsFromSummary } = await import('@/features/chat/services/suggestionExtraction')

    const suggestions = extractSuggestionsFromSummary(createDigestEntry({
      id: 'digest-2',
      summary: 'General discussion recap without any explicit next step.',
    }))

    expect(suggestions).toEqual([])
  })
})
