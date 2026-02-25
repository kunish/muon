import { check } from '@tauri-apps/plugin-updater'
import { ref } from 'vue'

export const updateAvailable = ref(false)
export const updateVersion = ref('')
export const updating = ref(false)

export async function checkForUpdates(): Promise<boolean> {
  try {
    const update = await check()
    if (update) {
      updateAvailable.value = true
      updateVersion.value = update.version
      return true
    }
    return false
  }
  catch {
    return false
  }
}

export async function installUpdate(): Promise<void> {
  updating.value = true
  try {
    const update = await check()
    if (update) {
      await update.downloadAndInstall()
    }
  }
  finally {
    updating.value = false
  }
}
