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
  it('uses a transparent frameless main Tauri window with an explicit clear background', () => {
    const config = readJson('src-tauri/tauri.conf.json') as {
      app: {
        macOSPrivateApi?: boolean
        windows: Array<{
          backgroundColor?: string
          decorations?: boolean
          shadow?: boolean
          transparent?: boolean
        }>
      }
    }

    expect(config.app.macOSPrivateApi).toBe(true)
    expect(config.app.windows[0]?.decorations).toBe(false)
    expect(config.app.windows[0]?.transparent).toBe(true)
    expect(config.app.windows[0]?.shadow).toBe(true)
    expect(config.app.windows[0]?.backgroundColor).toBe('#00000000')
    expect(readSource('src-tauri/Cargo.toml')).toMatch(/tauri = \{.*features = \[\s*"macos-private-api"\s*\].*\}/)
  })

  it('allows the frontend title bar to control the current window', () => {
    const capability = readJson('src-tauri/capabilities/default.json') as {
      permissions: Array<string | { identifier: string }>
    }

    expect(capability.permissions).toEqual(expect.arrayContaining([
      'core:window:allow-close',
      'core:window:allow-minimize',
      'core:window:allow-start-dragging',
      'core:window:allow-toggle-maximize',
    ]))
  })
})
