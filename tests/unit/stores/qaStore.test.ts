import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const askCrossSessionQuestionMock = vi.fn()
const listSavedQaSessionsMock = vi.fn()

vi.mock('@/features/chat/services/crossSessionQa', () => ({
  askCrossSessionQuestion: (...args: unknown[]) => askCrossSessionQuestionMock(...args),
  listSavedQaSessions: (...args: unknown[]) => listSavedQaSessionsMock(...args),
}))

describe('qaStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    askCrossSessionQuestionMock.mockReset()
    listSavedQaSessionsMock.mockReset()
  })

  it('hydrates saved qa sessions and uses the newest answer as active by default', async () => {
    listSavedQaSessionsMock.mockResolvedValue([
      {
        id: 'qa-2',
        question: 'Latest question',
        answer: 'Latest answer',
        citations: [{ roomId: '!room:muon.dev', eventId: '$event-2', quote: 'Latest answer' }],
        citationEventIds: ['$event-2'],
        createdAt: 200,
        updatedAt: 200,
      },
      {
        id: 'qa-1',
        question: 'Earlier question',
        answer: 'Earlier answer',
        citations: [{ roomId: '!room:muon.dev', eventId: '$event-1', quote: 'Earlier answer' }],
        citationEventIds: ['$event-1'],
        createdAt: 100,
        updatedAt: 100,
      },
    ])

    const { useQaStore } = await import('@/features/chat/stores/qaStore')
    const store = useQaStore()

    await store.hydrateHistory()

    expect(listSavedQaSessionsMock).toHaveBeenCalledTimes(1)
    expect(store.history).toHaveLength(2)
    expect(store.activeAnswer?.id).toBe('qa-2')
  })

  it('keeps previous history after asking a new question', async () => {
    listSavedQaSessionsMock.mockResolvedValue([
      {
        id: 'qa-1',
        question: 'Earlier question',
        answer: 'Earlier answer',
        citations: [{ roomId: '!room:muon.dev', eventId: '$event-1', quote: 'Earlier answer' }],
        citationEventIds: ['$event-1'],
        createdAt: 100,
        updatedAt: 100,
      },
    ])
    askCrossSessionQuestionMock.mockResolvedValue({
      id: 'qa-2',
      question: 'New question',
      answer: 'New answer',
      citations: [{ roomId: '!room:muon.dev', eventId: '$event-2', quote: 'New answer' }],
      citationEventIds: ['$event-2'],
      createdAt: 200,
      updatedAt: 200,
    })

    const { useQaStore } = await import('@/features/chat/stores/qaStore')
    const store = useQaStore()

    await store.hydrateHistory()
    await store.askQuestion('New question')

    expect(store.activeAnswer?.id).toBe('qa-2')
    expect(store.history.map(item => item.id)).toEqual(['qa-2', 'qa-1'])
  })
})
