import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'))
}

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('native window frame configuration', () => {
  it('uses the Electron native frame so the OS provides window controls', () => {
    const source = readSource('electron/main.ts')

    expect(source).toContain('frame: true')
    expect(source).toContain('titleBarStyle: \'hidden\'')
    expect(source).toContain('titleBarOverlay:')
    expect(source).toContain('trafficLightPosition:')
    expect(source).toContain('backgroundColor: \'#ffffff\'')
    expect(source).not.toContain('frame: false')
    expect(source).not.toContain('transparent: true')
    expect(source).toContain('contextIsolation: true')
    expect(source).toContain('nodeIntegration: false')
    expect(source).toContain('preload: getPreloadEntry()')
  })

  it('does not expose renderer-driven close, minimize, or maximize controls', () => {
    const mainSource = readSource('electron/main.ts')
    const preloadSource = readSource('electron/preload.ts')
    const rendererSource = readSource('src/electron/window.ts')

    expect(mainSource).not.toContain('muon:window:minimize')
    expect(mainSource).not.toContain('muon:window:close')
    expect(mainSource).not.toContain('muon:window:maximize')
    expect(preloadSource).not.toContain('muon:window:minimize')
    expect(preloadSource).not.toContain('muon:window:close')
    expect(preloadSource).not.toContain('muon:window:maximize')
    expect(preloadSource).toContain('ipcRenderer.invoke(\'muon:window:hide\')')
    expect(preloadSource).toContain('ipcRenderer.invoke(\'muon:window:show\')')
    expect(preloadSource).toContain('ipcRenderer.invoke(\'muon:window:focus\')')
    expect(rendererSource).toContain('getDesktopBridge()?.window')
    expect(rendererSource).not.toContain('close:')
    expect(rendererSource).not.toContain('minimize:')
    expect(rendererSource).not.toContain('maximize:')
  })

  it('keeps the sandboxed Electron preload compatible with limited Node APIs', () => {
    const preloadSource = readSource('electron/preload.ts')

    expect(preloadSource).not.toMatch(/(?:from\s+['"]node:process['"]|require\(['"]node:process['"]\))/)
  })

  it('does not require process to exist before exposing the desktop bridge', () => {
    const preloadSource = readSource('electron/preload.ts')

    expect(preloadSource).not.toContain('globalThis.process.platform')
    expect(preloadSource).toContain('globalThis.process?.platform')
  })

  it('uses electron-vite as the desktop build chain', () => {
    const pkg = readJson('package.json') as {
      main?: string
      scripts?: Record<string, string>
    }
    const config = readSource('electron.vite.config.ts')

    expect(pkg.main).toBe('out/main/main.cjs')
    expect(pkg.scripts?.dev).toBe('bash scripts/dev-all.sh')
    expect(pkg.scripts?.['dev:desktop']).toBe('electron-vite dev')
    expect(pkg.scripts?.build).toContain('pnpm build:desktop')
    expect(pkg.scripts?.['build:desktop']).toContain('electron-vite build')
    expect(config).toContain('entry: resolve(__dirname, \'electron/main.ts\')')
    expect(config).toContain('entry: resolve(__dirname, \'electron/preload.ts\')')
  })

  it('does not auto-open DevTools during local desktop development', () => {
    const source = readSource('electron/main.ts')

    expect(source).toContain('process.env.ELECTRON_RENDERER_URL')
    expect(source).toContain('mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)')
    expect(source).not.toContain('openDevTools')
  })

  it('marks the custom title bar drag region for both Electron and Electrobun', () => {
    const source = readSource('src/app/components/window/WindowTitleBar.vue')

    expect(source).toContain('data-electron-drag-region')
    expect(source).toContain('electrobun-webkit-app-region-drag')
    expect(source).toContain('-webkit-app-region: drag')
  })
})
