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
})
