import { settingsStore } from '@shared/stores/settingsStore'
import { setAutoLaunchEnabled, setCloseToTrayEnabled } from '@/desktop/app'

let stopDesktopSettingsSync: (() => void) | undefined

export function syncDesktopSettingsWithStore(): () => void {
  stopDesktopSettingsSync?.()

  let lastAutoLaunch = settingsStore.state.autoLaunch
  let lastCloseToTray = settingsStore.state.closeToTray

  // immediate sync
  void setAutoLaunchEnabled(lastAutoLaunch)
  void setCloseToTrayEnabled(lastCloseToTray)

  const subscription = settingsStore.subscribe(() => {
    const { autoLaunch, closeToTray } = settingsStore.state
    if (autoLaunch !== lastAutoLaunch) {
      lastAutoLaunch = autoLaunch
      void setAutoLaunchEnabled(autoLaunch)
    }
    if (closeToTray !== lastCloseToTray) {
      lastCloseToTray = closeToTray
      void setCloseToTrayEnabled(closeToTray)
    }
  })

  stopDesktopSettingsSync = () => {
    subscription.unsubscribe()
    stopDesktopSettingsSync = undefined
  }

  return stopDesktopSettingsSync
}
