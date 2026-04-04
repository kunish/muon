import { storeToRefs } from 'pinia'
import { watchEffect } from 'vue'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'

export function useTheme() {
  const settingsStore = useSettingsStore()
  const { theme } = storeToRefs(settingsStore)

  watchEffect(() => {
    const isDark = theme.value === 'dark'
      || (theme.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', isDark)
  })

  return { theme }
}
