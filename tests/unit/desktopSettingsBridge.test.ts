import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('desktop settings bridge', () => {
  it('routes launch and tray settings through preload IPC to the Electron main process', () => {
    const mainProcess = readSource('electron/main.ts')
    const preload = readSource('electron/preload.ts')
    const bridge = readSource('src/electron/bridge.ts')

    expect(mainProcess).toContain('muon:app:set-auto-launch')
    expect(mainProcess).toContain('app.setLoginItemSettings')
    expect(mainProcess).toContain('muon:app:set-close-to-tray')
    expect(mainProcess).toContain('mainWindow.on(\'close\'')
    expect(mainProcess).toContain('event.preventDefault()')
    expect(mainProcess).toContain('mainWindow?.hide()')

    expect(preload).toContain('setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke(\'muon:app:set-auto-launch\', enabled)')
    expect(preload).toContain('setCloseToTray: (enabled: boolean) => ipcRenderer.invoke(\'muon:app:set-close-to-tray\', enabled)')

    expect(bridge).toContain('setAutoLaunch: (enabled: boolean) => Promise<void>')
    expect(bridge).toContain('setCloseToTray: (enabled: boolean) => Promise<void>')
  })
})
