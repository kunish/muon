import { useTheme } from '@features/settings/composables/useTheme'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'

function createColorSchemeQuery(initialMatches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const query = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
      if (event === 'change')
        listeners.add(listener)
    }),
    removeEventListener: vi.fn((event: string, listener: (event: MediaQueryListEvent) => void) => {
      if (event === 'change')
        listeners.delete(listener)
    }),
    addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)),
    removeListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener)),
    dispatchEvent: vi.fn(),
    dispatchChange(matches: boolean) {
      query.matches = matches
      const event = { matches, media: query.media } as MediaQueryListEvent
      listeners.forEach(listener => listener(event))
    },
  }

  return query
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(createColorSchemeQuery(false)))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    document.documentElement.className = ''
  })

  it('applies theme changes from the settings store', async () => {
    const store = useSettingsStore()
    store.theme = 'light'

    const scope = effectScope()
    scope.run(() => useTheme())

    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    store.theme = 'dark'
    await nextTick()

    expect(document.documentElement.classList.contains('dark')).toBe(true)

    scope.stop()
  })

  it('updates when the system color scheme changes while following system', async () => {
    const systemTheme = createColorSchemeQuery(false)
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(systemTheme))

    const store = useSettingsStore()
    store.theme = 'system'

    const scope = effectScope()
    scope.run(() => useTheme())

    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    systemTheme.dispatchChange(true)
    await nextTick()

    expect(document.documentElement.classList.contains('dark')).toBe(true)

    scope.stop()
  })
})
