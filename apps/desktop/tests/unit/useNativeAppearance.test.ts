import { afterEach, describe, expect, it } from 'vitest'
import { applyAccent } from '@/app/composables/useNativeAppearance'

afterEach(() => {
  document.documentElement.style.removeProperty('--system-accent')
})

describe('applyAccent', () => {
  it('sets --system-accent when a hex is provided', () => {
    applyAccent('#0a84ff')
    expect(document.documentElement.style.getPropertyValue('--system-accent')).toBe('#0a84ff')
  })
  it('clears --system-accent when null (falls back to token default)', () => {
    applyAccent('#0a84ff')
    applyAccent(null)
    expect(document.documentElement.style.getPropertyValue('--system-accent')).toBe('')
  })
})
