import { ref } from 'vue'
import { getDesktopBridge } from './bridge'

export const updateAvailable = ref(false)
export const updateVersion = ref('')
export const updating = ref(false)

export async function checkForUpdates(): Promise<boolean> {
  const bridge = getDesktopBridge()
  if (!bridge) return false

  try {
    const update = await bridge.updater.check()
    if (!update) return false

    updateAvailable.value = true
    updateVersion.value = update.version
    return true
  } catch {
    return false
  }
}

export async function installUpdate(): Promise<void> {
  const bridge = getDesktopBridge()
  if (!bridge) return

  updating.value = true
  try {
    await bridge.updater.install()
  } finally {
    updating.value = false
  }
}
