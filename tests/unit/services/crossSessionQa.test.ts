import { describe, expect, it, vi } from 'vitest'

const searchRoomEventsMock = vi.fn()
const saveQaSessionMock = vi.fn()

vi.mock('@/matrix/retrieval', () => ({
  searchRoomEvents: (...args: unknown[]) => searchRoomEventsMock(...args),
}))

vi.mock('@/shared/lib/knowledgeDb', () => ({
  createKnowledgeRepository: () => ({
    saveQaSession: (...args: unknown[]) => saveQaSessionMock(...args),
  }),
}))

describe('crossSessionQa service', () => {
  it('returns a structured cited answer for a cross-session question', async () => {
    searchRoomEventsMock.mockResolvedValue({
      items: [
        {
          roomId: '!joined:muon.dev',
          eventId: '$event-1',
          body: 'Digest panel should ship this week.',
          sender: '@alice:muon.dev',
          ts: 1700000000000,
          rank: 0.9,
        },
      ],
    })
    saveQaSessionMock.mockImplementation(async answer => answer)

    const { askCrossSessionQuestion } = await import('@/features/chat/services/crossSessionQa')
    const answer = await askCrossSessionQuestion('What should ship this week?')

    expect(answer.answer).toContain('Digest panel should ship this week.')
    expect(answer.citations).toEqual([
      { roomId: '!joined:muon.dev', eventId: '$event-1', quote: 'Digest panel should ship this week.' },
    ])
    expect(saveQaSessionMock).toHaveBeenCalledTimes(1)
  })

  it('uses only joined-room scoped retrieval evidence', async () => {
    searchRoomEventsMock.mockResolvedValue({
      items: [
        {
          roomId: '!joined:muon.dev',
          eventId: '$event-1',
          body: 'Joined result',
          sender: '@alice:muon.dev',
          ts: 1700000000000,
          rank: 0.9,
        },
      ],
    })
    saveQaSessionMock.mockImplementation(async answer => answer)

    const { askCrossSessionQuestion } = await import('@/features/chat/services/crossSessionQa')
    await askCrossSessionQuestion('What is the current status?')

    expect(searchRoomEventsMock).toHaveBeenCalledWith('What is the current status?', 5)
  })
})
