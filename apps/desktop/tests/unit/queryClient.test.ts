import { describe, expect, it } from 'vitest'
import { createAppQueryClient } from '@/shared/query/queryClient'

describe('createAppQueryClient', () => {
  it('configures conservative query and mutation defaults', () => {
    const defaults = createAppQueryClient().getDefaultOptions()
    expect(defaults.queries?.staleTime).toBe(60_000)
    expect(defaults.queries?.gcTime).toBe(300_000)
    expect(defaults.queries?.retry).toBe(1)
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false)
    expect(defaults.mutations?.retry).toBe(0)
  })

  it('returns a fresh client on each call', () => {
    expect(createAppQueryClient()).not.toBe(createAppQueryClient())
  })
})
