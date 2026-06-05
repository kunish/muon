import { describe, expect, it } from 'vitest'
import { createTestQueryClient } from '../helpers/queryClient'

describe('createTestQueryClient', () => {
  it('disables retries and gc for deterministic tests', () => {
    const defaults = createTestQueryClient().getDefaultOptions()
    expect(defaults.queries?.retry).toBe(false)
    expect(defaults.queries?.gcTime).toBe(0)
    expect(defaults.mutations?.retry).toBe(false)
  })

  it('returns an isolated client on each call', () => {
    expect(createTestQueryClient()).not.toBe(createTestQueryClient())
  })
})
