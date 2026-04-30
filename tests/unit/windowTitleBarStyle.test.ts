import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('windowTitleBarStyle', () => {
  it('prevents the title bar text from showing an input cursor', () => {
    const source = readSource('src/app/components/window/WindowTitleBar.vue')

    expect(source).toContain('.window-titlebar *')
    expect(source).toContain('cursor: default')
  })

  it('styles the inactive Electron window state', () => {
    const source = readSource('src/app/components/window/WindowTitleBar.vue')

    expect(source).toContain('window-titlebar--inactive')
    expect(source).toContain('.window-titlebar--inactive .window-titlebar__brand')
    expect(source).toContain('.window-titlebar--inactive .window-titlebar__control--button')
    expect(source).not.toContain('.window-titlebar--inactive .window-titlebar__control--dot')
  })

  it('keeps macOS traffic light hover feedback on each dot control', () => {
    const source = readSource('src/app/components/window/WindowTitleBar.vue')

    expect(source).toContain('.window-titlebar__control--dot:hover .window-titlebar__dot-icon')
    expect(source).toContain('.window-titlebar__control--dot:active')
  })

  it('keeps Electron drag regions from covering window controls', () => {
    const source = readSource('src/app/components/window/WindowTitleBar.vue')

    expect(source).toContain('--window-titlebar-mac-controls-width')
    expect(source).toContain('--window-titlebar-default-controls-width')
    expect(source).toContain('.window-titlebar--mac .window-titlebar__drag-region')
    expect(source).toContain('margin-left: var(--window-titlebar-mac-controls-width)')
    expect(source).toContain('margin-right: var(--window-titlebar-default-controls-width)')
    expect(source).toContain('.window-titlebar__controls')
    expect(source).toContain('-webkit-app-region: no-drag')
  })
})
