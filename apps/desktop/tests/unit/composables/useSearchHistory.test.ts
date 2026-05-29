import { beforeEach, describe, expect, it } from 'vitest'
import { useSearchHistory } from '@/features/chat/composables/useSearchHistory'

describe('useSearchHistory', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('records most-recent-first and de-duplicates', () => {
    const { history, record } = useSearchHistory()
    record('alpha')
    record('beta')
    record('alpha')
    expect(history.value).toEqual(['alpha', 'beta'])
  })

  it('ignores empty/whitespace terms', () => {
    const { history, record } = useSearchHistory()
    record('   ')
    record('')
    expect(history.value).toEqual([])
  })

  it('caps history at 8 entries', () => {
    const { history, record } = useSearchHistory()
    for (let i = 0; i < 12; i++) record(`term-${i}`)
    expect(history.value).toHaveLength(8)
    expect(history.value[0]).toBe('term-11')
  })

  it('persists across instances via localStorage', () => {
    useSearchHistory().record('persisted')
    expect(useSearchHistory().history.value).toEqual(['persisted'])
  })

  it('removes and clears entries', () => {
    const session = useSearchHistory()
    session.record('keep')
    session.record('drop')
    session.remove('drop')
    expect(session.history.value).toEqual(['keep'])
    session.clear()
    expect(session.history.value).toEqual([])
    expect(useSearchHistory().history.value).toEqual([])
  })
})
