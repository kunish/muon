import type { BrowserWindowConstructorOptions } from 'electron'

export interface MainWindowChromeInput {
  platform: NodeJS.Platform
  dark: boolean
  accentHex: string | null
}

const DARK_BG = '#1a1a1a'
const LIGHT_BG = '#ffffff'

// Platform-branched window chrome. macOS gets native hiddenInset + vibrancy;
// Windows/Linux keep the existing WCO titlebar-overlay posture untouched.
export function buildMainWindowOptions(input: MainWindowChromeInput): Partial<BrowserWindowConstructorOptions> {
  const backgroundColor = input.dark ? DARK_BG : LIGHT_BG

  if (input.platform === 'darwin') {
    return {
      backgroundColor,
      roundedCorners: true,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 14, y: 12 },
      vibrancy: 'sidebar',
      visualEffectState: 'active',
    }
  }

  return {
    backgroundColor,
    titleBarOverlay: { color: '#00000000', height: 36 },
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 12 }, // ignored on Windows/Linux; kept for parity with prior unconditional behavior
  }
}
