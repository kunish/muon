import { beforeEach, describe, expect, it, vi } from 'vitest'

const setAutoLaunchEnabled = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const setCloseToTrayEnabled = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('@/desktop/app', () => ({
  setAutoLaunchEnabled,
  setCloseToTrayEnabled,
}))

describe('desktop settings sync', () => {
  beforeEach(() => {
    localStorage.clear()
    setAutoLaunchEnabled.mockClear()
    setCloseToTrayEnabled.mockClear()
    vi.resetModules()
  })

  it('syncs launch and tray settings at startup and after store changes', async () => {
    const { syncDesktopSettingsWithStore } = await import('@/app/plugins/desktopSettings')
    const { resetSettingsStore, setAutoLaunch, setCloseToTray } = await import('@/shared/stores/settingsStore')

    resetSettingsStore()
    const stopSync = syncDesktopSettingsWithStore()

    expect(setAutoLaunchEnabled).toHaveBeenCalledWith(false)
    expect(setCloseToTrayEnabled).toHaveBeenCalledWith(true)

    setAutoLaunch(true)
    setCloseToTray(false)

    expect(setAutoLaunchEnabled).toHaveBeenLastCalledWith(true)
    expect(setCloseToTrayEnabled).toHaveBeenLastCalledWith(false)
    stopSync()
  })
})
