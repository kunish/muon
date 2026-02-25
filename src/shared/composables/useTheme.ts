import { ref, watchEffect } from 'vue'

type Theme = 'light' | 'dark' | 'system'

const theme = ref<Theme>((localStorage.getItem('muon_theme') as Theme) || 'system')

export function useTheme() {
  watchEffect(() => {
    const isDark = theme.value === 'dark'
      || (theme.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('muon_theme', theme.value)
  })

  return { theme }
}
