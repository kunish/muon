import type { WatchStopHandle } from 'vue'
import { useSettingsStore } from '@shared/stores/settingsStore'
import { watch } from 'vue'
import { setAutoLaunchEnabled, setCloseToTrayEnabled } from '@/desktop/app'

let stopDesktopSettingsSync: WatchStopHandle | undefined

export function syncDesktopSettingsWithStore(): WatchStopHandle {
  stopDesktopSettingsSync?.()

  const settingsStore = useSettingsStore()
  const stopAutoLaunchSync = watch(
    () => settingsStore.autoLaunch,
    value => void setAutoLaunchEnabled(value),
    { immediate: true },
  )
  const stopCloseToTraySync = watch(
    () => settingsStore.closeToTray,
    value => void setCloseToTrayEnabled(value),
    { immediate: true },
  )

  stopDesktopSettingsSync = () => {
    stopAutoLaunchSync()
    stopCloseToTraySync()
    stopDesktopSettingsSync = undefined
  }

  return stopDesktopSettingsSync
}
