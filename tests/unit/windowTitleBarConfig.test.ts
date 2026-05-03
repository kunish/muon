import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'))
}

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('custom window title bar configuration', () => {
  it('uses a transparent frameless Electron BrowserWindow with a preload bridge', () => {
    const source = readSource('electron/main.ts')

    expect(source).toContain('frame: false')
    expect(source).toContain('backgroundColor: \'#00000000\'')
    expect(source).toContain('transparent: true')
    expect(source).toContain('contextIsolation: true')
    expect(source).toContain('nodeIntegration: false')
    expect(source).toContain('preload: getPreloadEntry()')
  })

  it('routes window controls through the Electron preload bridge', () => {
    const preloadSource = readSource('electron/preload.ts')
    const rendererSource = readSource('src/electron/window.ts')

    expect(preloadSource).toContain('ipcRenderer.invoke(\'muon:window:minimize\')')
    expect(preloadSource).toContain('ipcRenderer.invoke(\'muon:window:close\')')
    expect(preloadSource).toContain('ipcRenderer.invoke(\'muon:window:is-focused\')')
    expect(preloadSource).toContain('ipcRenderer.invoke(\'muon:window:current-monitor\')')
    expect(preloadSource).toContain('subscribe(\'muon:window:focused\'')
    expect(preloadSource).toContain('subscribe(\'muon:window:blurred\'')
    expect(preloadSource).toContain('subscribe(\'muon:window:moved\'')
    expect(rendererSource).toContain('getDesktopBridge()?.window')
    expect(rendererSource).toContain('getDesktopBridge()?.platform')
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
})
