import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('window frame style', () => {
  it('keeps the transparent native window clipped by the rounded app frame', () => {
    const app = readSource('src/app/App.vue')
    const css = readSource('src/app/main.css')

    expect(app).toContain('app-window-frame')
    expect(css).toContain('background: transparent')
    expect(css).toContain('.app-window-frame')
    expect(css).toContain('border-radius: 14px')
    expect(css).toContain('overflow: hidden')
    expect(css).toContain('box-shadow: 0 18px 48px')
    expect(css).toContain('.muon-window-maximized .app-window-frame')
  })
})
