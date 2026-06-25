// Pre-mount theme resolution so the .dark class lands before Vue mounts,
// killing the white flash on a dark cold-start. Mirrors useTheme()'s logic.
export function resolveBootDark(stored: string | null, prefersDark: boolean): boolean {
  if (stored === 'dark') return true
  if (stored === 'light') return false
  return prefersDark // 'system' or missing
}

export function applyBootTheme(): void {
  const stored = localStorage.getItem('muon_theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', resolveBootDark(stored, prefersDark))
}
