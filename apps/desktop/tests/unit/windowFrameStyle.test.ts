import { describe, expect, it } from 'vitest'
import { readDesktopSource, readRepoSource } from '../helpers/paths'

describe('window frame style', () => {
  it('keeps the custom title bar while relying on the native window frame', () => {
    const app = readDesktopSource('src/app/App.vue')
    const css = `${readRepoSource('packages/ui/src/styles.css')}\n${readDesktopSource('src/app/main.css')}`

    expect(app).toContain('WindowTitleBar')
    expect(app).not.toContain('app-window-frame')
    expect(css).not.toContain('.app-window-frame')
    expect(css).not.toContain('.muon-window-maximized .app-window-frame')
    expect(css).not.toContain('.muon-window-flush-frame .app-window-frame')
  })
})
