import { beforeEach, describe, expect, it, vi } from 'vitest'

import { askQuestionEntry, loadQaHistory, upsertQaAnswer } from '@/features/chat/queries/qaApi'

const askCrossSessionQuestionMock = vi.fn()
const listSavedQaSessionsMock = vi.fn()

vi.mock('@/features/chat/services/crossSessionQa', () => ({
  askCrossSessionQuestion: (...args: unknown[]) => askCrossSessionQuestionMock(...args),
  listSavedQaSessions: (...args: unknown[]) => listSavedQaSessionsMock(...args),
}))

function answer(id: string, createdAt: number) {
  return {
    id,
    question: `Q ${id}`,
    answer: `A ${id}`,
    citations: [{ roomId: '!room:muon.dev', eventId: `$${id}`, quote: `A ${id}` }],
    citationEventIds: [`$${id}`],
    createdAt,
    updatedAt: createdAt,
  }
}

beforeEach(() => {
  askCrossSessionQuestionMock.mockReset()
  listSavedQaSessionsMock.mockReset()
  listSavedQaSessionsMock.mockResolvedValue([])
})

describe('qaApi', () => {
  it('loadQaHistory returns saved sessions sorted newest-first', async () => {
    listSavedQaSessionsMock.mockResolvedValue([answer('qa-1', 100), answer('qa-2', 200)])

    const history = await loadQaHistory()

    expect(listSavedQaSessionsMock).toHaveBeenCalledTimes(1)
    expect(history.map((item) => item.id)).toEqual(['qa-2', 'qa-1'])
  })

  it('loadQaHistory returns an empty list when nothing is saved', async () => {
    const history = await loadQaHistory()
    expect(history).toEqual([])
  })

  it('askQuestionEntry delegates to the service and returns the answer', async () => {
    askCrossSessionQuestionMock.mockResolvedValue(answer('qa-9', 900))

    const result = await askQuestionEntry('What ships this week?')

    expect(askCrossSessionQuestionMock).toHaveBeenCalledWith('What ships this week?')
    expect(result.id).toBe('qa-9')
  })

  it('upsertQaAnswer prepends the new answer, dedupes by id, and keeps newest-first order', () => {
    const existing = [answer('qa-2', 200), answer('qa-1', 100)]

    const added = upsertQaAnswer(existing, answer('qa-3', 300))
    expect(added.map((item) => item.id)).toEqual(['qa-3', 'qa-2', 'qa-1'])

    const replaced = upsertQaAnswer(added, { ...answer('qa-2', 250), answer: 'updated' })
    expect(replaced.map((item) => item.id)).toEqual(['qa-3', 'qa-2', 'qa-1'])
    expect(replaced.find((item) => item.id === 'qa-2')?.answer).toBe('updated')
  })
})
