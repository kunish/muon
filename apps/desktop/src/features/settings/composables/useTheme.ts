import { storeToRefs } from 'pinia'
import { onScopeDispose, watch } from 'vue'
import { useSettingsStore } from '../stores/settingsStore'

export function useTheme() {
  const settingsStore = useSettingsStore()
  const { theme } = storeToRefs(settingsStore)
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')

  function applyTheme() {
    const isDark = theme.value === 'dark' || (theme.value === 'system' && systemTheme.matches)
    document.documentElement.classList.toggle('dark', isDark)
  }

  function handleSystemThemeChange() {
    if (theme.value === 'system') applyTheme()
  }

  watch(theme, applyTheme, { immediate: true })

  systemTheme.addEventListener('change', handleSystemThemeChange)

  onScopeDispose(() => {
    systemTheme.removeEventListener('change', handleSystemThemeChange)
  })

  return { theme }
}
