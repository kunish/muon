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

/**
 * Returns true when the given platform string indicates macOS.
 * Pure helper so it can be unit-tested without a DOM.
 */
export function shouldUseMacChrome(platform: string | undefined): boolean {
  const p = platform?.toLowerCase()
  return p === 'darwin' || p === 'mac' || p === 'macos' || p === 'osx'
}

/**
 * Sets `platform-darwin` on <html> when running on macOS, enabling
 * CSS-gated shell transparency for OS vibrancy. Must be called pre-mount
 * so no layout flash occurs.
 */
export function applyPlatformClass(): void {
  const platform = window.muonDesktop?.platform
  document.documentElement.classList.toggle('platform-darwin', shouldUseMacChrome(platform))
}
