import { useSelector } from '@tanstack/vue-store'
import { getDesktopBridge } from '@/desktop/bridge'
import { settingsStore } from '@/shared/stores/settingsStore'

export function applyAccent(hex: string | null): void {
  const root = document.documentElement
  if (hex) root.style.setProperty('--system-accent', hex)
  else root.style.removeProperty('--system-accent')
}

// Bridges the in-app appearance to the OS (nativeTheme) and injects the live
// system accent color into --system-accent. No-op outside Electron.
export function useNativeAppearance(): void {
  const bridge = getDesktopBridge()
  if (!bridge?.isElectron || !('theme' in bridge)) return
  const themeBridge = (
    bridge as unknown as {
      theme: {
        set: (m: 'light' | 'dark' | 'system') => Promise<string | null>
        getAccent: () => Promise<string | null>
        onAccentChanged: (cb: (hex: string | null) => void) => () => void
      }
    }
  ).theme

  const theme = useSelector(settingsStore, (s) => s.theme)

  watch(
    theme,
    (mode) => {
      void themeBridge.set(mode).then(applyAccent)
    },
    { immediate: true },
  )
  void themeBridge.getAccent().then(applyAccent)
  const off = themeBridge.onAccentChanged(applyAccent)
  onScopeDispose(off)
}
