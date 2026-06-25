import { beforeEach, describe, expect, it } from 'vitest'
import { resetSettingsStore, settingsStore } from '@/shared/stores/settingsStore'

describe('messageAlignment default', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSettingsStore()
  })
  it('defaults to leftright (iMessage) for macOS-native chat', () => {
    expect(settingsStore.state.messageAlignment).toBe('leftright')
  })
})
