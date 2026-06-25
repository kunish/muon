import { describe, expect, it } from 'vitest'
import { buildMainWindowOptions } from '../../electron/windowOptions'

describe('buildMainWindowOptions', () => {
  it('darwin: uses hiddenInset, vibrancy sidebar, no WCO overlay', () => {
    const o = buildMainWindowOptions({ platform: 'darwin', dark: false, accentHex: null })
    expect(o.titleBarStyle).toBe('hiddenInset')
    expect(o.vibrancy).toBe('sidebar')
    expect(o.visualEffectState).toBe('active')
    expect(o.roundedCorners).toBe(true)
    expect(o.titleBarOverlay).toBeUndefined() // WCO overlay is a no-op on mac
  })

  it('darwin: backgroundColor follows theme (no white flash in dark)', () => {
    expect(buildMainWindowOptions({ platform: 'darwin', dark: true, accentHex: null }).backgroundColor).toBe('#1a1a1a')
    expect(buildMainWindowOptions({ platform: 'darwin', dark: false, accentHex: null }).backgroundColor).toBe('#ffffff')
  })

  it('win32: keeps the WCO titlebar overlay + hidden style, no vibrancy', () => {
    const o = buildMainWindowOptions({ platform: 'win32', dark: false, accentHex: null })
    expect(o.titleBarStyle).toBe('hidden')
    expect(o.titleBarOverlay).toEqual({ color: '#00000000', height: 36 })
    expect(o.vibrancy).toBeUndefined()
  })
})
