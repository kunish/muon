import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const setAutoLaunchEnabled = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const setCloseToTrayEnabled = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('@/desktop/app', () => ({
  setAutoLaunchEnabled,
  setCloseToTrayEnabled,
}))

describe('desktop settings sync', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    setAutoLaunchEnabled.mockClear()
    setCloseToTrayEnabled.mockClear()
    vi.resetModules()
  })

  it('syncs launch and tray settings at startup and after store changes', async () => {
    const { syncDesktopSettingsWithStore } = await import('@/app/plugins/desktopSettings')
    const { useSettingsStore } = await import('@/features/settings/stores/settingsStore')
    const stopSync = syncDesktopSettingsWithStore()
    const settingsStore = useSettingsStore()

    expect(setAutoLaunchEnabled).toHaveBeenCalledWith(false)
    expect(setCloseToTrayEnabled).toHaveBeenCalledWith(true)

    settingsStore.autoLaunch = true
    settingsStore.closeToTray = false
    await nextTick()

    expect(setAutoLaunchEnabled).toHaveBeenLastCalledWith(true)
    expect(setCloseToTrayEnabled).toHaveBeenLastCalledWith(false)
    stopSync()
  })
})
