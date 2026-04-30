import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'))
}

describe('custom window title bar configuration', () => {
  it('uses a transparent frameless main Tauri window', () => {
    const config = readJson('src-tauri/tauri.conf.json') as {
      app: {
        macOSPrivateApi?: boolean
        windows: Array<{ decorations?: boolean, transparent?: boolean }>
      }
    }

    expect(config.app.macOSPrivateApi).toBe(true)
    expect(config.app.windows[0]?.decorations).toBe(false)
    expect(config.app.windows[0]?.transparent).toBe(true)
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
