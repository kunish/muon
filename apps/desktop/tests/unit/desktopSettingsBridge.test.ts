import { describe, expect, it } from 'vitest'
import { readDesktopSource } from '../helpers/paths'

describe('desktop settings bridge', () => {
  it('routes launch and tray settings through preload IPC to the Electron main process', () => {
    const mainProcess = readDesktopSource('electron/main.ts')
    const preload = readDesktopSource('electron/preload.ts')
    const bridge = readDesktopSource('src/desktop/bridge.ts')

    expect(mainProcess).toContain('muon:app:set-auto-launch')
    expect(mainProcess).toContain('app.setLoginItemSettings')
    expect(mainProcess).toContain('muon:app:set-close-to-tray')
    expect(mainProcess).toContain("mainWindow.on('close'")
    expect(mainProcess).toContain('event.preventDefault()')
    expect(mainProcess).toContain('mainWindow?.hide()')

    expect(preload).toContain(
      "setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('muon:app:set-auto-launch', enabled)",
    )
    expect(preload).toContain(
      "setCloseToTray: (enabled: boolean) => ipcRenderer.invoke('muon:app:set-close-to-tray', enabled)",
    )
    expect(preload).toContain("runtime: 'electron'")

    expect(bridge).toContain("export type DesktopRuntime = 'electron' | 'electrobun'")
    expect(bridge).toContain('runtime: DesktopRuntime')
    expect(bridge).toContain('export function getDesktopRuntime(): DesktopRuntime | undefined')
    expect(bridge).toContain('export function isElectrobunRuntime(): boolean')
    expect(bridge).toContain('setAutoLaunch: (enabled: boolean) => Promise<void>')
    expect(bridge).toContain('setCloseToTray: (enabled: boolean) => Promise<void>')
  })
})
