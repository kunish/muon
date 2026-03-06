import { describe, expect, it } from 'vitest'
import {
  citationRefSchema,
  decisionCardSchema,
  digestEntrySchema,
  toCitationEventIds,
} from '@/features/chat/types/knowledge'
import {
  createKnowledgeRepository,
  KNOWLEDGE_DB_NAME,
  KNOWLEDGE_DB_STORES,
  MuonKnowledgeDB,
} from '@/shared/lib/knowledgeDb'

function createFakeTable<T extends { id: string }>(seed: T[] = []) {
  const state = [...seed]

  return {
    async put(value: T) {
      const index = state.findIndex(item => item.id === value.id)
      if (index >= 0)
        state[index] = value
      else
        state.push(value)
      return value.id
    },
    async get(id: string) {
      return state.find(item => item.id === id)
    },
    async update(id: string, changes: Partial<T>) {
      const index = state.findIndex(item => item.id === id)
      if (index < 0)
        return 0
      state[index] = { ...state[index], ...changes }
      return 1
    },
    where(index: keyof T & string) {
      return {
        equals(value: unknown) {
          return {
            async toArray() {
              return state.filter(item => item[index] === value)
            },
          }
        },
      }
    },
    orderBy(index: keyof T & string) {
      return {
        reverse() {
          return {
            async toArray() {
              return [...state].sort((a, b) => Number(b[index]) - Number(a[index]))
            },
          }
        },
      }
    },
  }
}

describe('knowledge contracts and database', () => {
  it('requires roomId/eventId citations and rejects empty citation arrays', () => {
    expect(citationRefSchema.safeParse({ roomId: '!room:muon.dev', eventId: '$event-1' }).success).toBe(true)
    expect(citationRefSchema.safeParse({ roomId: '', eventId: '$event-1' }).success).toBe(false)

    const digestParse = digestEntrySchema.safeParse({
      id: 'digest-1',
      sessionId: 'session-1',
      title: 'Release digest',
      summary: 'Summary',
      relevance: 'responsibility',
      citations: [],
      citationEventIds: [],
      createdAt: 1,
      updatedAt: 1,
    })

    expect(digestParse.success).toBe(false)
  })

  it('declares indexed stores for digest, decision, and qa entities', () => {
    expect(KNOWLEDGE_DB_NAME).toBe('MuonKnowledgeDB')
    expect(KNOWLEDGE_DB_STORES.digestEntries).toContain('relevance')
    expect(KNOWLEDGE_DB_STORES.decisions).toContain('status')
    expect(KNOWLEDGE_DB_STORES.qaSessions).toContain('*citationEventIds')

    const db = new MuonKnowledgeDB()
    expect(db.name).toBe('MuonKnowledgeDB')
  })

  it('defaults suggestion disposition to pending and supports indexed repository queries', async () => {
    const digestEntry = digestEntrySchema.parse({
      id: 'digest-1',
      sessionId: 'session-1',
      title: 'Digest title',
      summary: 'Digest summary',
      relevance: 'responsibility',
      citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
      citationEventIds: ['$event-1'],
      createdAt: 1,
      updatedAt: 1,
    })

    const decision = decisionCardSchema.parse({
      id: 'decision-1',
      conclusion: 'Ship digest panel',
      context: 'Offline catch-up is missing',
      owner: '@alice:muon.dev',
      status: 'open',
      citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
      citationEventIds: toCitationEventIds([{ roomId: '!room:muon.dev', eventId: '$event-1' }]),
      suggestions: [
        {
          id: 'suggestion-1',
          kind: 'action',
          summary: 'Create the shared knowledge DB',
          citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
          citationEventIds: ['$event-1'],
          updatedAt: 1,
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    })

    expect(decision.suggestions[0].disposition).toBe('pending')

    const repository = createKnowledgeRepository({
      digestEntries: createFakeTable([digestEntry]),
      decisions: createFakeTable([decision]),
      qaSessions: createFakeTable([
        {
          id: 'qa-1',
          question: 'What changed?',
          answer: 'The digest pipeline was added.',
          citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
          citationEventIds: ['$event-1'],
          createdAt: 2,
          updatedAt: 2,
        },
      ]),
    })

    await expect(repository.listDigestEntries('responsibility')).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ relevance: 'responsibility' })]),
    )
    await expect(repository.listDecisionCards('open')).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ status: 'open' })]),
    )
    await expect(repository.listQaSessions()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ answer: expect.any(String) })]),
    )

    const updatedDecision = await repository.updateSuggestionDisposition('decision-1', 'suggestion-1', 'accepted', '@alice:muon.dev', 3)
    expect(updatedDecision.suggestions[0]).toMatchObject({
      disposition: 'accepted',
      updatedBy: '@alice:muon.dev',
      updatedAt: 3,
    })
  })
})
