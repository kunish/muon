import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('windowTitleBarStyle', () => {
  it('keeps the custom title bar style and drag region', () => {
    const source = readSource('src/app/components/window/WindowTitleBar.vue')

    expect(source).toContain('.window-titlebar')
    expect(source).toContain('background-image: linear-gradient')
    expect(source).toContain('.window-titlebar__brand')
    expect(source).toContain('.window-titlebar__drag-region')
    expect(source).toContain('-webkit-app-region: drag')
  })

  it('reserves space for native system window controls without styling custom buttons', () => {
    const source = readSource('src/app/components/window/WindowTitleBar.vue')

    expect(source).toContain('--window-titlebar-mac-controls-width')
    expect(source).toContain('--window-titlebar-default-controls-width')
    expect(source).toContain('.window-titlebar--mac .window-titlebar__drag-region')
    expect(source).not.toContain('.window-titlebar__control')
    expect(source).not.toContain('data-testid="window-close"')
    expect(source).not.toContain('data-testid="window-minimize"')
    expect(source).not.toContain('data-testid="window-maximize"')
  })
})
