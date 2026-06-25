import type { BrowserWindow } from 'electron'

export type AppearanceMode = 'light' | 'dark' | 'system'

export function resolveThemeSource(mode: AppearanceMode): AppearanceMode {
  return mode // nativeTheme.themeSource accepts exactly these three values
}

// macOS getAccentColor() → "RRGGBBAA" hex (no #). Strip alpha, prefix #.
export function normalizeAccentColor(raw: string | null | undefined): string | null {
  if (!raw) return null
  const hex = raw.trim().toLowerCase()
  if (!/^[0-9a-f]{6,8}$/.test(hex)) return null
  return `#${hex.slice(0, 6)}`
}

function readAccent(): string | null {
  // eslint-disable-next-line ts/no-require-imports -- lazy require avoids electron resolution in jsdom tests
  const { systemPreferences } = require('electron') as typeof import('electron')
  try {
    return normalizeAccentColor(systemPreferences.getAccentColor?.())
  } catch {
    return null
  }
}

export function registerThemeIpc(getWindow: () => BrowserWindow | null): void {
  // eslint-disable-next-line ts/no-require-imports -- lazy require avoids electron resolution in jsdom tests
  const { ipcMain, nativeTheme, systemPreferences } = require('electron') as typeof import('electron')

  ipcMain.handle('muon:theme:set', (_e, mode: AppearanceMode) => {
    nativeTheme.themeSource = resolveThemeSource(mode)
    return readAccent()
  })
  ipcMain.handle('muon:theme:get-accent', () => readAccent())

  // Push live OS accent changes to the renderer.
  try {
    systemPreferences.on?.('accent-color-changed', () => {
      getWindow()?.webContents.send('muon:theme:accent-changed', readAccent())
    })
  } catch {
    // non-macOS platforms may not emit this — renderer keeps its fallback
  }
}
