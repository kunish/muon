import { beforeEach, describe, expect, it } from 'vitest'
import { qaStore, resetQaStore, selectQaAnswer } from '@/features/chat/stores/qaStore'

describe('qaStore (client selection)', () => {
  beforeEach(() => {
    resetQaStore()
  })

  it('starts with no selected answer', () => {
    expect(qaStore.state.selectedAnswerId).toBeNull()
  })

  it('selectQaAnswer records the selected id', () => {
    selectQaAnswer('qa-1')
    expect(qaStore.state.selectedAnswerId).toBe('qa-1')
  })

  it('selectQaAnswer(null) clears the selection', () => {
    selectQaAnswer('qa-1')
    selectQaAnswer(null)
    expect(qaStore.state.selectedAnswerId).toBeNull()
  })

  it('resetQaStore restores the initial state', () => {
    selectQaAnswer('qa-2')
    resetQaStore()
    expect(qaStore.state.selectedAnswerId).toBeNull()
  })
})
