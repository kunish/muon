import { beforeEach, describe, expect, it } from 'vitest'
import { resetSettingsStore, settingsStore, togglePinnedApp } from '@/shared/stores/settingsStore'

describe('pinnedApps', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSettingsStore()
  })

  it('hydrates the default pinned set when storage is empty', () => {
    expect(settingsStore.state.pinnedApps).toEqual(['messages', 'calendar', 'docs', 'tasks', 'contacts', 'workplace'])
  })

  it('toggling an unpinned id pins it', () => {
    togglePinnedApp('email')
    expect(settingsStore.state.pinnedApps).toContain('email')
  })

  it('toggling a pinned id unpins it', () => {
    togglePinnedApp('messages')
    expect(settingsStore.state.pinnedApps).not.toContain('messages')
  })

  it('persists pinnedApps to localStorage as a JSON array', () => {
    togglePinnedApp('email')
    expect(JSON.parse(localStorage.getItem('muon_pinned_apps')!)).toContain('email')
  })
})
