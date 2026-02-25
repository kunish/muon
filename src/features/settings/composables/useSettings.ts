import type { ThemeMode } from '../stores/settingsStore'
import { watch } from 'vue'
import { useSettingsStore } from '../stores/settingsStore'

export function useSettings() {
  const store = useSettingsStore()

  function applyTheme(mode: ThemeMode) {
    const root = document.documentElement
    if (mode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
    }
    else {
      root.classList.toggle('dark', mode === 'dark')
    }
  }

  function initThemeWatcher() {
    applyTheme(store.theme)
    watch(() => store.theme, applyTheme)

    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        if (store.theme === 'system')
          applyTheme('system')
      })
  }

  return { applyTheme, initThemeWatcher }
}
