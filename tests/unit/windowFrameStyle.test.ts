import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('window frame style', () => {
  it('keeps the custom title bar while relying on the native window frame', () => {
    const app = readSource('src/app/App.vue')
    const css = `${readSource('packages/ui/src/styles.css')}\n${readSource('src/app/main.css')}`

    expect(app).toContain('WindowTitleBar')
    expect(app).not.toContain('app-window-frame')
    expect(css).not.toContain('.app-window-frame')
    expect(css).not.toContain('.muon-window-maximized .app-window-frame')
    expect(css).not.toContain('.muon-window-flush-frame .app-window-frame')
  })
})
